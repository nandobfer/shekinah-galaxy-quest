import { describe, expect, it } from 'vitest';
import { catalog, roleInputSchema, roleMembersSchema, roleReorderSchema, userAccessUpdateSchema, viewAsSchema } from '../permissions.js';
const id = '000000000000000000000001';
describe('catálogo e contratos Perfix do Shekinah', () => {
  it('declara apenas módulos existentes e normaliza dependências de visualização', () => {
    expect(catalog.isKnownKey('users.edit')).toBe(true);
    expect(catalog.isKnownKey('integrations.crons.run')).toBe(true);
    expect(catalog.isKnownKey('campanhas.view')).toBe(false);
    expect(catalog.normalizePermissionDependencies(['users.edit', 'integrations.smtp.explore'])).toEqual(expect.arrayContaining(['users.view', 'integrations.smtp.view']));
  });
  it('não aceita escopos, campos extras ou permissões desconhecidas', () => {
    const base = { nome: 'Perfil', descricao: '', cor: 'roxo', ativo: true, permissoes: [], escopos: [] };
    expect(roleInputSchema.safeParse(base).success).toBe(true);
    for (const patch of [{ escopos: ['empresa:1'] }, { permissoes: ['inventado.view'] }, { slug: 'admin' }]) expect(roleInputSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it('exige versões e IDs únicos, não aceita cadastro/senha no contrato de edição', () => {
    expect(roleMembersSchema.safeParse({ membros: [id, id], version: 0 }).success).toBe(false);
    expect(roleReorderSchema.safeParse({ ordem: [id], version: 0 }).success).toBe(false);
    expect(userAccessUpdateSchema.safeParse({ nome: 'Operador', ativo: true, cargos: [id] }).success).toBe(false);
    expect(userAccessUpdateSchema.safeParse({ nome: 'Operador', ativo: true, cargos: [], version: 0, password: 'qualquer' }).success).toBe(false);
    expect(viewAsSchema.safeParse({ tipo: 'cargo', roleId: id, escopos: ['1'] }).success).toBe(false);
  });
});
