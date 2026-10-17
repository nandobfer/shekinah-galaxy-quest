import { Schema, type Model, type Connection } from 'mongoose';

export interface AccessRole {
  slug: string; nome: string; descricao: string; cor: string; permissoes: string[]; ativo: boolean; escopos: never[];
  version: number; createdBy?: string; updatedBy?: string; createdAt: Date; updatedAt: Date;
}
export const AccessRoleSchema = new Schema<AccessRole>({
  slug: { type: String, required: true, immutable: true }, nome: { type: String, required: true }, descricao: { type: String, default: '' }, cor: { type: String, required: true },
  permissoes: { type: [String], default: [] }, ativo: { type: Boolean, default: true }, escopos: { type: [String], default: [] },
  version: { type: Number, default: 0 }, createdBy: String, updatedBy: String,
}, { collection: 'roles', timestamps: true });
AccessRoleSchema.index({ slug: 1 }, { unique: true });
export interface AccessState { _id: string; ordem: string[]; version: number; fence: number; }
export const AccessStateSchema = new Schema<AccessState>({ _id: String, ordem: { type: [String], default: [] }, version: { type: Number, default: 0 }, fence: { type: Number, default: 0 } }, { collection: 'role_hierarchy' });
export interface AccessAudit { actorId: string; action: string; targetId: string; before?: unknown; after?: unknown; simulation?: unknown; createdAt: Date; }
export const AccessAuditSchema = new Schema<AccessAudit>({ actorId: { type: String, required: true }, action: { type: String, required: true }, targetId: { type: String, required: true }, before: Schema.Types.Mixed, after: Schema.Types.Mixed, simulation: Schema.Types.Mixed }, { collection: 'access_audit', timestamps: { createdAt: true, updatedAt: false } });
AccessAuditSchema.index({ targetId: 1, createdAt: -1 });

/** Operator-only seed. It never rewrites an existing profile or assigns existing users. */
export async function ensureAdministrator(connection: Connection) {
  const roles = (connection.models.AccessRole ?? connection.model<AccessRole>('AccessRole', AccessRoleSchema)) as Model<AccessRole>;
  await roles.init();
  const admin = await roles.findOneAndUpdate({ slug: 'admin' }, { $setOnInsert: { nome: 'Administrador', descricao: 'Todas as permissões, inclusive as futuras', cor: 'vermelho', permissoes: ['*'], ativo: true, escopos: [], createdBy: 'operator-cli' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }).orFail();
  if (!admin.ativo || admin.permissoes.length !== 1 || admin.permissoes[0] !== '*') throw new Error('O perfil Administrador está inconsistente; revise a configuração antes de continuar.');
  return admin;
}
