import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { encodeViewAs } from '@nandobfer/perfix';
import { objectIdSchema, viewAsEventSchema } from '@shekinah/contracts';
import { IntegrationMutationGuard } from '../integrations/integrations.controller.js';
import { AccessService, type AccessRequest } from './access.service.js';
import { AccessCommands, parseInput } from './access.commands.js';

@Controller()
@UseGuards(IntegrationMutationGuard)
export class AccessController {
  constructor(@Inject(AccessService) private readonly access: AccessService, @Inject(AccessCommands) private readonly commands: AccessCommands) {}

  @Get('roles') async roles(@Req() req: AccessRequest) {
    await this.access.require(req.accessContext, 'roles.view');
    const users = await this.access.users.find().select('_id roles').lean();
    const actors = await this.access.users.find().select('_id name').lean();
    const names = new Map(actors.map(user => [String(user._id), user.name]));
    const roles = (await this.access.roleRows()).map(role => ({ ...role,
      membros: users.filter(user => user.roles.includes(role.id)).map(user => String(user._id)),
      usuariosCount: users.filter(user => user.roles.includes(role.id)).length,
      createdByNome: role.createdBy ? names.get(role.createdBy) : undefined, updatedByNome: role.updatedBy ? names.get(role.updatedBy) : undefined,
    })).sort((a, b) => a.posicao - b.posicao);
    return { roles, total: roles.length, hierarchyVersion: (await this.access.states.findById('global'))?.version ?? 0 };
  }
  @Post('roles') createRole(@Req() req: AccessRequest, @Body() body: unknown) { return this.commands.createRole(req, body); }
  @Put('roles/reorder') reorder(@Req() req: AccessRequest, @Body() body: unknown) { return this.commands.reorder(req, body); }
  @Patch('roles/:id') updateRole(@Req() req: AccessRequest, @Param('id') id: string, @Body() body: unknown) { return this.commands.updateRole(req, parseInput(objectIdSchema, id), body); }
  @Delete('roles/:id') deleteRole(@Req() req: AccessRequest, @Param('id') id: string, @Query('version') version: string) { return this.commands.deleteRole(req, parseInput(objectIdSchema, id), parseInput(z.coerce.number().int().nonnegative(), version)); }
  @Put('roles/:id/members') members(@Req() req: AccessRequest, @Param('id') id: string, @Body() body: unknown) { return this.commands.members(req, parseInput(objectIdSchema, id), body); }
  @Get('users') async users(@Req() req: AccessRequest) { await this.access.require(req.accessContext, 'users.view'); return this.access.userRows(req.accessContext); }
  @Get('users/assignable-roles') async assignable(@Req() req: AccessRequest) { await this.access.require(req.accessContext, 'users.edit'); return this.access.assignable(req.accessContext); }
  @Patch('users/:id') updateUser(@Req() req: AccessRequest, @Param('id') id: string, @Body() body: unknown) { return this.commands.updateUser(req, parseInput(objectIdSchema, id), body); }
  @Delete('users/:id') deleteUser(@Req() req: AccessRequest, @Param('id') id: string, @Query('version') version: string) { return this.commands.deleteUser(req, parseInput(objectIdSchema, id), parseInput(z.coerce.number().int().nonnegative(), version)); }

  @Get('view-as/roles') async viewRoles(@Req() req: AccessRequest) {
    this.access.realAdministrator(req.accessContext);
    return (await this.access.roleRows()).filter(role => role.ativo).sort((a, b) => a.posicao - b.posicao);
  }
  @Get('view-as/users') async viewUsers(@Req() req: AccessRequest, @Query('q') value?: string) {
    this.access.realAdministrator(req.accessContext);
    const q = parseInput(z.string().max(100), value ?? '');
    const regex = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await this.access.users.find({ active: true, ...(q ? { $or: [{ name: { $regex: regex, $options: 'i' } }, { email: { $regex: regex, $options: 'i' } }] } : {}) }).sort({ name: 1, _id: 1 }).limit(20).select('_id name email roles');
    const roles = await this.access.roleRows();
    return users.map(user => ({ id: user.id as string, nome: user.name, email: user.email, cargos: roles.filter(role => user.roles.includes(role.id)) }));
  }
  @Post('view-as/events') async event(@Req() req: AccessRequest, @Body() body: unknown) {
    this.access.realAdministrator(req.accessContext);
    const data = parseInput(viewAsEventSchema, body);
    const next = await this.access.resolve(req.adminSession.user.id, data.next ? encodeViewAs(data.next) : 'none');
    await this.access.audit({ ...req.accessContext, dto: { ...req.accessContext.dto, simulation: next.dto.simulation } }, `view-as.${data.kind}`, req.adminSession.user.id, data.previous, data.next);
    return { ok: true };
  }
}
