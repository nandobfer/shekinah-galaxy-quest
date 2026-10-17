import type { Connection } from 'mongoose';
import { UserSchema, type User } from '../../apps/api/src/modules/users/user.schema.js';
import { AccessAuditSchema, AccessStateSchema, ensureAdministrator, type AccessAudit, type AccessState } from '../../apps/api/src/modules/permissions/access.schema.js';
import { supportsAuthorityTransactions } from '../../apps/api/src/modules/permissions/access-topology.js';

/** Thrown before any write when the operator's MongoDB cannot run authority transactions. */
export class ReplicaSetRequiredError extends Error {}

/** Explicit operator migration; never called by API startup. An access edit disqualifies an account from legacy seeding. */
export async function migrateLegacyAccess(connection: Connection, apply = false) {
  const users = connection.model<User>('User', UserSchema);
  const filter = { role: 'admin' as const, accessVersion: { $exists: false }, $or: [{ roles: { $exists: false } }, { roles: { $size: 0 } }] };
  const eligible = await users.countDocuments(filter);
  if (!apply || !eligible) return { eligible, migrated: 0 };
  if (!(await supportsAuthorityTransactions(connection))) throw new ReplicaSetRequiredError('A migração exige MongoDB com replica set; nenhuma conta foi alterada. Inicie o MongoDB com --replSet e execute rs.initiate() antes de aplicar.');
  const administrator = await ensureAdministrator(connection);
  const states = connection.model<AccessState>('AccessState', AccessStateSchema);
  const audits = connection.model<AccessAudit>('AccessAudit', AccessAuditSchema);
  await Promise.all([states.init(), audits.init()]);
  await states.updateOne({ _id: 'global' }, { $setOnInsert: { ordem: [], version: 0, fence: 0 } }, { upsert: true });
  const migrated = await connection.transaction(async session => {
    await states.updateOne({ _id: 'global' }, { $inc: { fence: 1 } }, { session });
    const candidates = await users.find(filter).session(session);
    for (const user of candidates) {
      user.roles = [administrator.id as string]; user.accessVersion = 1;
      await user.save({ session });
      await audits.create([{ actorId: 'operator-cli', action: 'access.migrate', targetId: user.id, before: { cargos: [] }, after: { cargos: user.roles }, simulation: null }], { session });
    }
    return candidates.length;
  }, { readPreference: 'primary', writeConcern: { w: 'majority' } });
  return { eligible, migrated };
}
