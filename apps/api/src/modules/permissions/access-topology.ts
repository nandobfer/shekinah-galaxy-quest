import type { Connection } from 'mongoose';

/** Authority mutations run multi-document transactions, which a standalone server cannot provide. */
export const AUTHORITY_TOPOLOGY_MESSAGE = 'A administração de acessos exige MongoDB com replica set. Nenhuma alteração foi aplicada.';

/** Replica set (`setName`) or mongos (`isdbgrid`) support transactions; a standalone server does not. */
export async function supportsAuthorityTransactions(connection: Connection): Promise<boolean> {
  const hello: { setName?: string; msg?: string } = await connection.db!.admin().command({ hello: 1 });
  return Boolean(hello.setName) || hello.msg === 'isdbgrid';
}
