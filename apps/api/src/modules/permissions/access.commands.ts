import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ClientSession } from 'mongoose';
import { z } from 'zod';
import { canManageRole, canManageUser, evaluateRoleAssignment, getUngrantableKeys } from '@nandobfer/perfix';
import { catalog, roleInputSchema, roleUpdateSchema, roleReorderSchema, roleMembersSchema, userAccessUpdateSchema } from '@shekinah/contracts';
import { AccessService, forbidden, type AccessContext, type AccessRequest } from './access.service.js';

export function parseInput<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.issues.map(issue => issue.message).join(' '));
  return result.data;
}
const conflict = () => new ConflictException('Os acessos foram alterados por outra pessoa. Recarregue e revise antes de salvar.');

@Injectable()
export class AccessCommands {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  async createRole(req: AccessRequest, body: unknown) {
    const data = parseInput(roleInputSchema, body);
    data.permissoes = catalog.normalizePermissionDependencies(data.permissoes);
    return this.access.transaction(req, ['roles.edit'], async (context, session) => {
      if (!canManageRole(context.roles, { permissoes: [] }) || data.permissoes.includes('*') || getUngrantableKeys(context.effective, data.permissoes).length) throw forbidden();
      const slug = data.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!slug || slug === 'admin') throw new BadRequestException('Nome de perfil reservado ou inválido.');
      if (await this.access.roles.exists({ slug }).session(session)) throw new ConflictException('Já existe um perfil com esse nome.');
      const order = (await this.access.roleRows(session)).sort((a, b) => a.posicao - b.posicao).map(role => role.id);
      const [role] = await this.access.roles.create([{ ...data, slug, permissoes: catalog.normalizePermissionDependencies(data.permissoes), createdBy: context.userId }], { session });
      if (!role) throw new Error('Falha ao criar perfil.');
      await this.access.states.updateOne({ _id: 'global' }, { $set: { ordem: [...order, role.id as string] }, $inc: { version: 1 } }, { session });
      await this.access.audit(context, 'role.create', role.id as string, null, data, session);
      return { id: role.id as string };
    });
  }

  async updateRole(req: AccessRequest, id: string, body: unknown) {
    const { version, membros, ...data } = parseInput(roleUpdateSchema, body);
    if (data.permissoes) data.permissoes = catalog.normalizePermissionDependencies(data.permissoes);
    return this.access.transaction(req, ['roles.edit', ...(membros ? ['users.edit'] : [])], async (context, session) => {
      const role = await this.access.roles.findById(id).session(session);
      if (!role) throw new NotFoundException('Perfil não encontrado.');
      if (version !== role.version) throw conflict();
      if (role.slug === 'admin') {
        if (!context.effective.has('*') || Object.keys(data).some(key => !['nome', 'descricao', 'cor'].includes(key))) throw forbidden('O Administrador permite alterar apenas nome, descrição e cor.');
      } else if (!canManageRole(context.roles, role) || data.permissoes?.includes('*') || getUngrantableKeys(context.effective, data.permissoes ?? []).length) throw forbidden();
      const before = { nome: role.nome, descricao: role.descricao, cor: role.cor, permissoes: [...role.permissoes], ativo: role.ativo };
      Object.assign(role, data, { updatedBy: context.userId, version: version + 1 });
      if (data.permissoes) role.permissoes = catalog.normalizePermissionDependencies(data.permissoes);
      await role.save({ session });
      if (membros) await this.applyMembers(context, id, membros, session);
      await this.access.audit(context, 'role.update', id, before, data, session);
      return { id };
    });
  }

  async deleteRole(req: AccessRequest, id: string, version: number) {
    return this.access.transaction(req, ['roles.edit'], async (context, session) => {
      const role = await this.access.roles.findById(id).session(session);
      if (!role) throw new NotFoundException('Perfil não encontrado.');
      if (role.version !== version) throw conflict();
      if (role.slug === 'admin' || !canManageRole(context.roles, role)) throw forbidden();
      if (await this.access.users.exists({ roles: id }).session(session)) throw new ConflictException('Remova os membros antes de excluir o perfil.');
      await this.access.roles.deleteOne({ _id: id }, { session });
      await this.access.states.updateOne({ _id: 'global' }, { $pull: { ordem: id }, $inc: { version: 1 } }, { session });
      await this.access.audit(context, 'role.delete', id, { nome: role.nome, permissoes: role.permissoes }, null, session);
      return { id };
    });
  }

  async reorder(req: AccessRequest, body: unknown) {
    const { ordem, version } = parseInput(roleReorderSchema, body);
    return this.access.transaction(req, ['roles.edit'], async (context, session) => {
      const state = await this.access.states.findById('global').session(session).orFail();
      if (state.version !== version) throw conflict();
      const rows = (await this.access.roleRows(session)).sort((a, b) => a.posicao - b.posicao);
      if (ordem.some(id => { const role = rows.find(row => row.id === id); return !role || !canManageRole(context.roles, role); })) throw forbidden();
      const selected = new Set(ordem); let index = 0;
      const next = rows.map(role => selected.has(role.id) ? ordem[index++] as string : role.id);
      await this.access.states.updateOne({ _id: 'global' }, { $set: { ordem: next }, $inc: { version: 1 } }, { session });
      await this.access.audit(context, 'role.reorder', 'global', rows.map(role => role.id), next, session);
      return { alterados: ordem.length };
    });
  }

  private async saveUser(context: AccessContext, id: string, data: z.infer<typeof userAccessUpdateSchema>, session: ClientSession) {
    const user = await this.access.users.findById(id).session(session);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (data.version !== user.accessVersion) throw conflict();
    const rows = await this.access.roleRows(session);
    const current = rows.filter(role => user.roles.includes(role.id));
    if (current.length !== user.roles.length || !canManageUser(context.roles, current)) throw forbidden('Usuário fora do alcance da sua hierarquia.');
    const changeRoles = data.cargos.length !== user.roles.length || data.cargos.some(role => !user.roles.includes(role));
    if (id === context.userId && (changeRoles || !data.ativo)) throw forbidden('Você não pode alterar seus próprios perfis nem desativar sua conta.');
    const result = evaluateRoleAssignment({ catalog, callerCargos: context.roles, requested: data.cargos, current: user.roles, loaded: rows });
    if (result.status !== 'ok') throw forbidden('Um ou mais perfis não podem ser atribuídos.');
    const admin = rows.find(role => role.slug === 'admin');
    if (admin && user.active && user.roles.includes(admin.id) && (!data.ativo || !result.cargos.includes(admin.id))) {
      if (await this.access.users.countDocuments({ active: true, roles: admin.id }).session(session) <= 1) throw new ConflictException('Não é permitido remover o último administrador ativo.');
    }
    const before = { nome: user.name, ativo: user.active, cargos: [...user.roles] };
    user.name = data.nome; user.active = data.ativo; user.roles = result.cargos; user.accessVersion += 1;
    if (!data.ativo) user.sessionVersion += 1;
    await user.save({ session });
    await this.access.audit(context, 'user.update', id, before, { nome: user.name, ativo: user.active, cargos: user.roles }, session);
  }

  async updateUser(req: AccessRequest, id: string, body: unknown) {
    const data = parseInput(userAccessUpdateSchema, body);
    return this.access.transaction(req, ['users.edit'], async (context, session) => {
      await this.saveUser(context, id, data, session);
      return { id };
    });
  }

  async members(req: AccessRequest, id: string, body: unknown) {
    const { membros, version } = parseInput(roleMembersSchema, body);
    return this.access.transaction(req, ['roles.edit', 'users.edit'], async (context, session) => {
      const role = await this.access.roles.findById(id).session(session);
      if (!role) throw new NotFoundException('Perfil não encontrado.');
      if (version !== role.version) throw conflict();
      const result = await this.applyMembers(context, id, membros, session);
      await this.access.roles.updateOne({ _id: id }, { $inc: { version: 1 } }, { session });
      return result;
    });
  }

  private async applyMembers(context: AccessContext, id: string, membros: string[], session: ClientSession) {
    const role = await this.access.roles.findById(id).session(session).orFail();
    if (role.slug === 'admin' ? !context.effective.has('*') : !canManageRole(context.roles, role)) throw forbidden();
    const users = await this.access.users.find({ $or: [{ roles: id }, { _id: { $in: membros } }] }).session(session);
    if (membros.some(member => !users.some(user => user.id === member))) throw new BadRequestException('Usuário não encontrado.');
    let adicionados = 0; let removidos = 0;
    for (const user of users) {
      const selected = membros.includes(user.id as string); const assigned = user.roles.includes(id);
      if (selected === assigned) continue;
      if (selected && !role.ativo) throw new ConflictException('Perfil inativo não pode receber membros.');
      await this.saveUser(context, user.id as string, { nome: user.name, ativo: user.active, cargos: selected ? [...user.roles, id] : user.roles.filter(value => value !== id), version: user.accessVersion }, session);
      if (selected) adicionados += 1; else removidos += 1;
    }
    await this.access.audit(context, 'role.members', id, null, { membros }, session);
    return { adicionados, removidos, total: membros.length };
  }

  async deleteUser(req: AccessRequest, id: string, version: number) {
    return this.access.transaction(req, ['users.edit'], async (context, session) => {
      if (id === context.userId) throw forbidden('Você não pode excluir sua própria conta.');
      const user = await this.access.users.findById(id).session(session);
      if (!user) throw new NotFoundException('Usuário não encontrado.');
      if (user.accessVersion !== version) throw conflict();
      const rows = await this.access.roleRows(session); const current = rows.filter(role => user.roles.includes(role.id));
      if (current.length !== user.roles.length || !canManageUser(context.roles, current)) throw forbidden();
      const admin = rows.find(role => role.slug === 'admin');
      if (admin && user.active && user.roles.includes(admin.id) && await this.access.users.countDocuments({ active: true, roles: admin.id }).session(session) <= 1) throw new ConflictException('Não é permitido excluir o último administrador ativo.');
      await this.access.audit(context, 'user.delete', id, { nome: user.name, email: user.email, cargos: user.roles, ativo: user.active }, null, session);
      await this.access.users.deleteOne({ _id: id }, { session });
      return { id };
    });
  }
}
