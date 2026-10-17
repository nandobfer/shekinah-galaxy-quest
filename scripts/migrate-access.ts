import 'dotenv/config';
import { createConnection } from 'mongoose';
import { resolveScriptMongoUri, ScriptMongoConfigError } from './helpers/mongodb-uri.js';
import { migrateLegacyAccess, ReplicaSetRequiredError } from './helpers/migrate-legacy-access.js';
import { supportsAuthorityTransactions } from '../apps/api/src/modules/permissions/access-topology.js';

const DRY_RUN_NOTICE = 'Nenhuma atribuição foi alterada. Use --apply somente após revisar o banco e autorizar a migração.';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--apply')) throw new Error('Use apenas --apply para executar a migração; sem essa opção, o script apenas informa a quantidade de contas elegíveis.');
  const applying = args.includes('--apply');
  const connection = createConnection(resolveScriptMongoUri(process.env.MONGODB_URI), { serverSelectionTimeoutMS: 5000 });
  try {
    await connection.asPromise();
    const result = await migrateLegacyAccess(connection, applying);
    if (applying) return console.info(`${result.migrated} conta(s) migrada(s) para o perfil Administrador.`);
    console.info(`${result.eligible} conta(s) elegível(is). ${DRY_RUN_NOTICE}`);
    // Avoid pointing the operator to an --apply that the current topology will refuse.
    if (result.eligible > 0 && !(await supportsAuthorityTransactions(connection))) console.warn('O MongoDB conectado é standalone: --apply exigirá replica set com rs.initiate().');
  } finally { await connection.close(); }
}
main().catch(error => {
  const safe = error instanceof ScriptMongoConfigError || error instanceof ReplicaSetRequiredError;
  console.error(safe ? (error as Error).message : 'Não foi possível migrar os acessos. Verifique os argumentos e a conexão.');
  process.exitCode = 1;
});
