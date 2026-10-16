import 'reflect-metadata';
import 'dotenv/config';
import { input, password } from '@inquirer/prompts';
import { createConnection } from 'mongoose';
import { createAdminSchema } from '@shekinah/contracts';
import { UserSchema, type User } from '../apps/api/src/modules/users/user.schema.js';
import { DuplicateAdminError, UsersService } from '../apps/api/src/modules/users/users.service.js';
import { createLogger } from '../apps/api/src/logger.js';
import { resolveScriptMongoUri, ScriptMongoConfigError } from './helpers/mongodb-uri.js';

class OperatorInputError extends Error {}

async function main() {
  if (!process.stdin.isTTY) throw new OperatorInputError('Execute em um terminal interativo; senhas não são aceitas por argumentos ou pipe.');
  const uri = resolveScriptMongoUri(process.env.MONGODB_URI);
  const name = await input({ message: 'Nome:' });
  const email = await input({ message: 'E-mail:' });
  const secret = await password({ message: 'Senha (12 a 128 caracteres):', mask: '*' });
  const confirmation = await password({ message: 'Confirme a senha:', mask: '*' });
  if (secret !== confirmation) throw new OperatorInputError('As senhas não coincidem.');
  const result = createAdminSchema.safeParse({ name, email, password: secret });
  if (!result.success) throw new OperatorInputError(result.error.issues.map(issue => issue.message).join('\n'));
  const connection = createConnection(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await connection.asPromise();
    const users = new UsersService(connection.model<User>('User', UserSchema));
    const admin = await users.createAdmin(result.data);
    createLogger().info({ action: 'admin.created', actor: 'operator-cli', targetId: admin.id }, 'Administrador cadastrado');
    console.info('Administrador cadastrado. Faça login com o e-mail e a senha informados.');
  } finally { await connection.close(); }
}

main().catch(error => {
  const safe = error instanceof DuplicateAdminError || error instanceof OperatorInputError || error instanceof ScriptMongoConfigError;
  console.error(safe ? (error as Error).message : 'Não foi possível cadastrar o administrador. Verifique a conexão e a configuração do MongoDB.');
  process.exitCode = 1;
});
