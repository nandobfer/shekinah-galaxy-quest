import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../login-page';
import { api, queryClient, sessionKey } from '../session';

const particleState = vi.hoisted(() => ({ fail: false }));
vi.mock('@shekinah/api-client', () => ({ createApiClient: () => ({ login: vi.fn(), session: vi.fn(), logout: vi.fn() }) }));
// O fundo de partículas é decorativo: aqui ele só existe para provar que não derruba o formulário.
vi.mock('../login-particle-background', () => ({
  LoginParticleBackground: () => {
    if (particleState.fail) throw new Error('efeito indisponível');
    return null;
  },
}));
beforeEach(() => { queryClient.clear(); vi.mocked(api.login).mockReset(); particleState.fail = false; });
function setup() { render(<QueryClientProvider client={queryClient}><LoginPage /></QueryClientProvider>); return userEvent.setup(); }

describe('login administrativo', () => {
  it('apresenta a identidade Shekinah no layout centralizado do Opex', async () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Shekinah' })).toBeTruthy();
    expect(screen.getByText('Galaxy Quest · Administrativo')).toBeTruthy();
    expect(screen.getByRole('form', { name: 'Acesso administrativo' })).toBeTruthy();
    expect(screen.queryByText('nandoburgos.dev')).toBeNull();
  });
  it('valida campos sem chamar a API e alterna visibilidade', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: /^Entrar/ }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy();
    expect(screen.getByText('Informe sua senha.')).toBeTruthy();
    expect(api.login).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('text');
  });
  it('envia credenciais normalizadas e atualiza a sessão', async () => {
    const session = { user: { id: '1', name: 'Admin', email: 'admin@example.test', role: 'admin' as const }, expires: '2030-01-01T00:00:00.000Z' };
    vi.mocked(api.login).mockResolvedValue(session);
    const user = setup();
    await user.type(screen.getByLabelText('E-mail'), 'ADMIN@example.test');
    await user.type(screen.getByLabelText('Senha'), 'long-password-123');
    await user.click(screen.getByRole('button', { name: /^Entrar/ }));
    await waitFor(() => expect(api.login).toHaveBeenCalledWith({ email: 'admin@example.test', password: 'long-password-123' }));
    await waitFor(() => expect(queryClient.getQueryData(sessionKey)).toEqual(session));
  });
  it('exibe falha acionável sem apagar os campos', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('E-mail ou senha inválidos.'));
    const user = setup();
    await user.type(screen.getByLabelText('E-mail'), 'admin@example.test');
    await user.type(screen.getByLabelText('Senha'), 'wrong');
    await user.click(screen.getByRole('button', { name: /^Entrar/ }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'E-mail ou senha inválidos.');
    expect(screen.getByLabelText('Senha').getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('admin@example.test');
  });
  it('mantém o formulário disponível quando o fundo de partículas falha', async () => {
    particleState.fail = true;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      setup();
      expect(screen.getByRole('heading', { name: 'Shekinah' })).toBeTruthy();
      expect(screen.getByRole('form', { name: 'Acesso administrativo' })).toBeTruthy();
    } finally {
      consoleError.mockRestore();
    }
  });
  it('bloqueia submissão enquanto aguarda o servidor', async () => {
    let finish!: (value: Awaited<ReturnType<typeof api.login>>) => void;
    vi.mocked(api.login).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const user = setup();
    await user.type(screen.getByLabelText('E-mail'), 'admin@example.test');
    await user.type(screen.getByLabelText('Senha'), 'password');
    await user.click(screen.getByRole('button', { name: /^Entrar/ }));
    expect((await screen.findByRole('button', { name: 'Entrando…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.login).toHaveBeenCalledTimes(1);
    finish({ user: { id: '1', name: 'Admin', email: 'admin@example.test', role: 'admin' }, expires: '2030-01-01T00:00:00.000Z' });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Entrar/ })).toBeTruthy());
  });
});
