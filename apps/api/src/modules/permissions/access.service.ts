import { ForbiddenException, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, type ClientSession } from 'mongoose';
import { expandPermissions, resolveViewAs, readViewAs, canManageUser, getUnassignableRoles, type RoleLike } from '@nandobfer/perfix';
import { createGuards } from '@nandobfer/perfix/server';
import { catalog, type Access, type AdminSession } from '@shekinah/contracts';
import type { Request } from 'express';
import type { User } from '../users/user.schema.js';
import type { AccessRole, AccessState, AccessAudit } from './access.schema.js';
import { AUTHORITY_TOPOLOGY_MESSAGE, supportsAuthorityTransactions } from './access-topology.js';

export interface AccessContext {
  userId: string; roles: RoleLike[]; realRoles: RoleLike[]; effective: ReadonlySet<string>; realEffective: ReadonlySet<string>; dto: Access;
}
export type AccessRequest = Request & { adminSession: AdminSession; accessContext: AccessContext };
export const forbidden = (message = 'Você não tem permissão para esta operação.', code = 'FORBIDDEN') => new ForbiddenException({ error: { code, message }, message });

@Injectable()
export class AccessService {
  constructor(
    @InjectConnection() readonly connection: Connection,
    @InjectModel('User') readonly users: Model<User>,
    @InjectModel('AccessRole') readonly roles: Model<AccessRole>,
    @InjectModel('AccessState') readonly states: Model<AccessState>,
    @InjectModel('AccessAudit') readonly audits: Model<AccessAudit>,
  ) {}

  async roleRows(session: ClientSession | null = null) {
    const rows = await this.roles.find().session(session).sort({ createdAt: 1, _id: 1 });
    const state = await this.states.findById('global').session(session);
    const positions = new Map((state?.ordem ?? []).map((id, position) => [id, position]));
    return rows.map((role, index) => ({
      id: role.id as string, _id: role.id as string, slug: role.slug, nome: role.nome, descricao: role.descricao, cor: role.cor,
      permissoes: catalog.sanitizePermissions(role.permissoes), escopos: [] as never[], ativo: role.ativo,
      posicao: role.slug === 'admin' ? 0 : positions.get(role.id as string) ?? rows.length + index, version: role.version,
      createdAt: role.createdAt.toISOString(), updatedAt: role.updatedAt.toISOString(), createdBy: role.createdBy, updatedBy: role.updatedBy,
    }));
  }

  async resolve(userId: string, header: string | undefined, session: ClientSession | null = null): Promise<AccessContext> {
    const user = await this.users.findById(userId).session(session);
    if (!user?.active) throw new UnauthorizedException();
    const rows = await this.roleRows(session);
    const realRoles = rows.filter(role => user.roles.includes(role.id));
    const realEffective = expandPermissions(realRoles);
    const parsed = readViewAs({ header });
    if (parsed.invalid) throw forbidden('Simulação inválida. Saia da simulação e tente novamente.', 'VIEW_AS_INVALID');
    const resolution = await resolveViewAs({
      real: { userId, nome: user.name, effective: realEffective }, viewAs: parsed.viewAs,
      loadRole: async id => rows.find(role => role.id === id && role.ativo) ?? null,
      loadTarget: async id => {
        if (!/^[a-f\d]{24}$/i.test(id)) return null;
        const target = await this.users.findById(id).session(session);
        return target ? { id, nome: target.name, ativo: target.active, roles: rows.filter(role => target.roles.includes(role.id)) } : null;
      },
    });
    if (resolution.status === 'forbidden') throw forbidden('Somente administradores reais podem simular acesso.', 'VIEW_AS_FORBIDDEN');
    if (resolution.status === 'invalid') throw forbidden('O perfil ou usuário simulado não está disponível.', 'VIEW_AS_INVALID');
    const roles = resolution.status === 'ok' ? resolution.subject.roles : realRoles;
    const effective = resolution.status === 'ok' ? resolution.effective : realEffective;
    return { userId, roles, realRoles, effective, realEffective, dto: {
      permissions: [...effective], realIsAdministrator: realEffective.has('*'),
      roles: roles.map(role => ({ id: role.id, slug: role.slug, nome: role.nome, cor: rows.find(row => row.id === role.id)?.cor ?? 'cinza', permissoes: [...role.permissoes], ativo: role.ativo !== false, posicao: role.posicao ?? Number.MAX_SAFE_INTEGER, escopos: [] })),
      simulation: resolution.status === 'ok' ? resolution.marker : null,
    } };
  }

  async require(context: AccessContext, ...permissions: string[]) {
    const guards = createGuards({ catalog, getAuth: async () => context });
    for (const key of permissions) {
      try { await guards.requirePermission(key); } catch { throw forbidden(); }
    }
  }

  realAdministrator(context: AccessContext) { if (!context.realEffective.has('*')) throw forbidden('Somente administradores reais podem simular acesso.', 'VIEW_AS_FORBIDDEN'); }

  async transaction<T>(req: AccessRequest, permissions: string[], action: (context: AccessContext, session: ClientSession) => Promise<T>): Promise<T> {
    await this.require(req.accessContext, ...permissions);
    if (!(await supportsAuthorityTransactions(this.connection))) throw new ServiceUnavailableException(AUTHORITY_TOPOLOGY_MESSAGE);
    // All authority mutations contend on the same document, preventing write skew and rechecking authorization after a retry.
    await this.states.updateOne({ _id: 'global' }, { $setOnInsert: { ordem: [], version: 0, fence: 0 } }, { upsert: true });
    return this.connection.transaction(async session => {
      await this.states.updateOne({ _id: 'global' }, { $inc: { fence: 1 } }, { session });
      const context = await this.resolve(req.adminSession.user.id, req.get('x-perfix-view-as'), session);
      await this.require(context, ...permissions);
      return action(context, session);
    }, { readPreference: 'primary', writeConcern: { w: 'majority' }, maxCommitTimeMS: 10000 });
  }

  async audit(context: AccessContext, action: string, targetId: string, before: unknown, after: unknown, session?: ClientSession) {
    await this.audits.create([{ actorId: context.userId, action, targetId, before, after, simulation: context.dto.simulation }], { session });
  }

  async userRows(context: AccessContext, session: ClientSession | null = null) {
    const rows = await this.roleRows(session);
    const users = await this.users.find().sort({ name: 1, _id: 1 }).session(session);
    return users.map(user => {
      const cargos = rows.filter(role => user.roles.includes(role.id));
      const resolvidos = cargos.length === user.roles.length;
      return { id: user.id as string, nome: user.name, email: user.email, ativo: user.active, version: user.accessVersion,
        cargos, roleIds: [...user.roles], gerenciavel: resolvidos && canManageUser(context.roles, cargos) };
    });
  }

  async assignable(context: AccessContext) {
    const roles = (await this.roleRows()).filter(role => role.ativo);
    const blocked = new Map(getUnassignableRoles(catalog, context.roles, roles).map(role => [role.id, role.motivo]));
    return roles.map(role => ({ ...role, bloqueado: blocked.has(role.id), motivo: blocked.get(role.id) }));
  }
}
