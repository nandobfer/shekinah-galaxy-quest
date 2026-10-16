import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../app';
import { api, queryClient } from '../../features/auth/session';

vi.mock('@shekinah/api-client', () => ({ createApiClient: () => ({ login: vi.fn(), session: vi.fn(), logout: vi.fn() }) }));
const session = { user: { id: '1', name: 'Operador', email: 'admin@example.test', role: 'admin' as const }, expires: '2030-01-01T00:00:00.000Z' };
beforeEach(() => { queryClient.clear(); vi.resetAllMocks(); window.history.replaceState({}, '', '/'); });
function setup() { render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>); return userEvent.setup(); }
describe('rotas administrativas', () => {
  it('redireciona visitante ao login', async () => {
    vi.mocked(api.session).mockResolvedValue(null); setup();
    expect(await screen.findByRole('heading', { name: 'Shekinah' }, { timeout: 5000 })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
  });
  it('restaura sessão e sai com limpeza do cache protegido', async () => {
    vi.mocked(api.session).mockResolvedValue(session);
    vi.mocked(api.logout).mockResolvedValue(undefined);
    queryClient.setQueryData(['protected', 'example'], { private: true });
    const user = setup();
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Operador' }));
    vi.mocked(api.session).mockResolvedValue(null);
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Shekinah' })).toBeTruthy();
    expect(queryClient.getQueryData(['protected', 'example'])).toBeUndefined();
  });
  it('protege acesso direto às integrações sem sessão', async () => {
    window.history.replaceState({}, '', '/integracoes/pusher');
    vi.mocked(api.session).mockResolvedValue(null); setup();
    expect(await screen.findByRole('heading', { name: 'Shekinah' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
    expect(screen.queryByRole('navigation')).toBeNull();
  });
  it('oferece nova tentativa quando API está indisponível', async () => {
    vi.mocked(api.session).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(null);
    const user = setup();
    expect(await screen.findByRole('heading', { name: 'Não foi possível conectar' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Shekinah' })).toBeTruthy());
  });
});
