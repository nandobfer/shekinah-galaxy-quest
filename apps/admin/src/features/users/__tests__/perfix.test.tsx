import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { readViewAs, expandPermissions } from '@nandobfer/perfix';
import { getViewAsHeaderValue } from '@nandobfer/perfix/react';
import type { AdminSession, AdminUserDto, RoleDto } from '@shekinah/contracts';
import { App } from '../../../app/app';
import { api, queryClient } from '../../auth/session';

configure({ asyncUtilTimeout: 5000 });

vi.mock('@shekinah/api-client', () => ({ createApiClient: () => ({
  session: vi.fn(), login: vi.fn(), logout: vi.fn(),
  permissions: { roles: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(), deleteRole: vi.fn(), reorder: vi.fn(), members: vi.fn(), users: vi.fn(), assignable: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn(), viewRoles: vi.fn(), viewUsers: vi.fn(), viewEvent: vi.fn() },
  integrations: { list: vi.fn(), detail: vi.fn(), save: vi.fn(), test: vi.fn(), logs: vi.fn(), runHealthCheck: vi.fn() },
}) }));
const rootId = '000000000000000000000001';
const otherId = '000000000000000000000002';
const adminId = '000000000000000000000010';
const limitedId = '000000000000000000000011';
const role = (id: string, nome: string, permissoes: string[], posicao: number): RoleDto => ({ id, _id: id, nome, slug: posicao === 0 ? 'admin' : 'leitor', permissoes, cor: 'roxo', descricao: '', ativo: true, posicao, escopos: [], version: 0, membros: [], usuariosCount: 0, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' });
const administrator = role(adminId, 'Administrador', ['*'], 0);
const limited = role(limitedId, 'Leitor', ['roles.view', 'integrations.pusher.view'], 1);
const users: AdminUserDto[] = [
  { id: rootId, nome: 'Operador real', email: 'operator@example.test', cargos: [administrator], roleIds: [adminId], ativo: true, version: 0, gerenciavel: true },
  { id: otherId, nome: 'Maria Teste', email: 'maria@example.test', cargos: [limited], roleIds: [limitedId], ativo: true, version: 0, gerenciavel: true },
];
let identity: AdminSession;
beforeEach(() => {
  vi.resetAllMocks(); queryClient.clear(); sessionStorage.clear(); window.history.replaceState({}, '', '/');
  Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
  identity = { user: { id: rootId, name: 'Operador real', email: 'operator@example.test', role: 'admin' }, expires: '2030-01-01T00:00:00.000Z', access: { permissions: ['*'], roles: [administrator], realIsAdministrator: true, simulation: null } };
  vi.mocked(api.session).mockImplementation(async () => {
    const state = readViewAs({ header: getViewAsHeaderValue() }).viewAs;
    if (!state) return identity;
    return { ...identity, access: { roles: [limited], permissions: [...expandPermissions([limited])], realIsAdministrator: true, simulation: { tipo: state.tipo, alvoId: state.tipo === 'cargo' ? state.roleId : state.userId, alvoNome: state.tipo === 'cargo' ? limited.nome : users[1]!.nome } } };
  });
  vi.mocked(api.permissions.roles).mockResolvedValue({ roles: [administrator, limited], total: 2, hierarchyVersion: 0 });
  vi.mocked(api.permissions.users).mockResolvedValue(users);
  vi.mocked(api.permissions.assignable).mockResolvedValue([administrator, limited].map(item => ({ ...item, bloqueado: false })));
  vi.mocked(api.permissions.viewRoles).mockResolvedValue([administrator, limited]);
  vi.mocked(api.permissions.viewUsers).mockResolvedValue([users[1]!]);
  vi.mocked(api.permissions.viewEvent).mockResolvedValue(undefined);
  vi.mocked(api.permissions.createRole).mockResolvedValue({ id: '000000000000000000000012' });
  vi.mocked(api.permissions.updateRole).mockResolvedValue({ id: limitedId });
  vi.mocked(api.permissions.updateUser).mockResolvedValue(undefined);
});
function setup(path: string) {
  window.history.replaceState({}, '', path);
  render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
  return userEvent.setup();
}

describe('menus e telas permissionadas', () => {
  it('bloqueia rota direta sem acessar dados e não interpreta role legado como coringa', async () => {
    identity = { ...identity, access: { permissions: [], roles: [], realIsAdministrator: false, simulation: null } };
    setup('/perfis');
    expect(await screen.findByRole('heading', { name: 'Sem acesso' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'Menu principal' })).getAllByRole('link')).toHaveLength(1);
    expect(api.permissions.roles).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Visualizar como outro/ })).toBeNull();
  });
  it('leitor vê o perfil sem criação, controles editáveis ou salvar; sem escopos', async () => {
    identity = { ...identity, access: { permissions: ['roles.view'], roles: [limited], realIsAdministrator: false, simulation: null } };
    setup(`/perfis/${limitedId}`);
    const field = await screen.findByRole('textbox', { name: /Nome/ });
    expect((field as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Membros' })).toBeNull();
    expect(screen.queryByText('Empresas e filiais')).toBeNull();
    expect(screen.queryByText('Escopos')).toBeNull();
  });
  it('cria perfil por página própria com tabs e mantém rodapé fora da área rolável', async () => {
    const user = setup('/perfis');
    await user.click(await screen.findByRole('button', { name: 'Novo Perfil' }));
    expect(window.location.pathname).toBe('/perfis/novo');
    await user.type(await screen.findByRole('textbox', { name: /Nome/ }), 'Operador');
    await user.click(screen.getByRole('tab', { name: 'Permissões' }));
    expect(await screen.findByRole('tabpanel', { name: 'Permissões' })).toBeTruthy();
    await user.keyboard('{Home}');
    expect(await screen.findByRole('tabpanel', { name: 'Geral' })).toBeTruthy();
    await user.keyboard('{End}');
    expect(await screen.findByRole('tabpanel', { name: 'Permissões' })).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Salvar' });
    expect(save.closest('form')?.querySelector('.overflow-y-auto')?.contains(save)).toBe(false);
    await user.click(save);
    await waitFor(() => expect(api.permissions.createRole).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Operador', escopos: [], permissoes: [] })));
    await waitFor(() => expect(window.location.pathname).toBe('/perfis'));
  });
  it('protege rascunho ao navegar, preserva em falha e exibe erro recuperável', async () => {
    vi.mocked(api.permissions.updateRole).mockRejectedValue(new Error('Versão concorrente'));
    const user = setup(`/perfis/${limitedId}`);
    const name = await screen.findByRole('textbox', { name: /Nome/ });
    await user.clear(name); await user.type(name, 'Rascunho');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.permissions.updateRole).toHaveBeenCalled());
    expect((screen.getByRole('textbox', { name: /Nome/ }) as HTMLInputElement).value).toBe('Rascunho');
    expect(window.location.pathname).toBe(`/perfis/${limitedId}`);
  });
  it('usuários não oferecem cadastro/convite e edição usa somente Geral/Perfis', async () => {
    const user = setup('/usuarios');
    const maria = await screen.findByRole('row', { name: /Maria Teste/ });
    expect(screen.queryByRole('button', { name: /Novo Usuário|Convidar|Cadastrar/ })).toBeNull();
    await user.click(within(maria).getByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar Usuário' });
    expect(within(dialog).getAllByRole('tab').map(item => item.textContent)).toEqual(['Geral', 'Perfis']);
    const email = within(dialog).getByRole('textbox', { name: /E-mail/ }) as HTMLInputElement;
    expect(email.readOnly || email.disabled).toBe(true);
    const name = within(dialog).getByRole('textbox', { name: /Nome/ });
    await user.clear(name); await user.type(name, 'Maria Atualizada');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar Alterações' }));
    await waitFor(() => expect(api.permissions.updateUser).toHaveBeenCalledWith(otherId, { nome: 'Maria Atualizada', ativo: true, cargos: [limitedId], version: 0 }));
  });
  it('lista erro de conexão com tentativa novamente', async () => {
    vi.mocked(api.permissions.roles).mockRejectedValueOnce(new Error('offline'));
    const user = setup('/perfis');
    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('button', { name: 'Novo Perfil' })).toBeTruthy();
    expect(await screen.findByText('Leitor')).toBeTruthy();
  });
  it('descarta rascunho de usuário ao fechar e reabrir a mesma pessoa', async () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const user = setup('/usuarios');
      const row = await screen.findByRole('row', { name: /Maria Teste/ });
      await user.click(within(row).getByRole('button', { name: 'Editar' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar Usuário' });
      const name = within(dialog).getByRole('textbox', { name: /Nome/ });
      await user.clear(name); await user.type(name, 'Descartar rascunho');
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar Usuário' })).toBeNull());
      await user.click(within(row).getByRole('button', { name: 'Editar' }));
      const reopened = await screen.findByRole('dialog', { name: 'Editar Usuário' });
      expect((within(reopened).getByRole('textbox', { name: /Nome/ }) as HTMLInputElement).value).toBe('Maria Teste');
      expect(api.permissions.updateUser).not.toHaveBeenCalled();
    } finally { confirmation.mockRestore(); }
  });
});

describe('Visualizar como sem escopos', () => {
  it('troca perfil, cancela cache protegido, mantém aviso e restaura acesso ao sair', async () => {
    const user = setup('/');
    queryClient.setQueryData(['protected-example'], { secret: 'cache-real' });
    await user.click(await screen.findByRole('button', { name: 'Visualizar como outro perfil ou usuário' }));
    await user.click(await screen.findByRole('option', { name: 'Leitor' }));
    expect(await screen.findByRole('button', { name: 'Sair da simulação' })).toBeTruthy();
    expect(queryClient.getQueryData(['protected-example'])).toBeUndefined();
    expect(within(screen.getByRole('navigation', { name: 'Menu principal' })).queryByRole('link', { name: 'Usuários' })).toBeNull();
    expect(api.permissions.viewEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'inicio', next: { tipo: 'cargo', roleId: limitedId } }));
    await user.click(screen.getByRole('button', { name: 'Sair da simulação' }));
    expect(await screen.findByRole('link', { name: 'Usuários' })).toBeTruthy();
    expect(getViewAsHeaderValue()).toBe('none');
  });
  it('seleciona usuário sem empresa/filial e encerra simulação invalidada pelo servidor', async () => {
    const user = setup('/');
    await user.click(await screen.findByRole('button', { name: 'Visualizar como outro perfil ou usuário' }));
    await user.click(await screen.findByRole('button', { name: 'Selecionar usuário' }));
    await user.click(await screen.findByRole('option', { name: /Maria Teste/ }));
    expect(await screen.findByRole('button', { name: 'Sair da simulação' })).toBeTruthy();
    expect(api.permissions.viewEvent).toHaveBeenCalledWith(expect.objectContaining({ next: { tipo: 'usuario', userId: otherId } }));
    act(() => window.dispatchEvent(new Event('perfix:invalid')));
    expect(await screen.findByRole('link', { name: 'Usuários' })).toBeTruthy();
    expect(getViewAsHeaderValue()).toBe('none');
  });
});
