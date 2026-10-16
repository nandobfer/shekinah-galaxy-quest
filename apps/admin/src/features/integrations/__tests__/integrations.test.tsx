import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { INTEGRATIONS, type Integration, type IntegrationId, HEALTH_CHECK_JOB_ID, HEALTH_CHECK_JOB_LABEL } from '@shekinah/contracts';
import { App } from '../../../app/app';
import { api, queryClient } from '../../auth/session';

vi.mock('@shekinah/api-client', () => ({ createApiClient: () => ({ session: vi.fn(), logout: vi.fn(), login: vi.fn(), integrations: { list: vi.fn(), detail: vi.fn(), save: vi.fn(), logs: vi.fn(), test: vi.fn(), runHealthCheck: vi.fn() } }) }));
const session = { user: { id: '1', name: 'Fernando Teste', email: 'operator@example.test', role: 'admin' as const }, expires: '2030-01-01T00:00:00.000Z' };
function fixture(id: IntegrationId): Integration {
  const def = INTEGRATIONS.find(item => item.id === id)!;
  return { id, name: def.name, description: def.description, ...(def.parent ? { parent: def.parent } : {}), environment: def.environment,
    version: 0, debugMode: false, configured: false, encryptionKeyConfigured: true, updatedAt: null,
    publicValues: Object.fromEntries(def.fields.map(field => [field.key, field.defaultValue ?? ''])),
    secrets: Object.fromEntries(def.secrets.map(field => [field.key, { configured: false, unreadable: false }])),
    health: { state: 'not_configured', message: 'Não configurado', checkedAt: null, latencyMs: null },
    ...(id === 'crons' ? { cronState: { id: HEALTH_CHECK_JOB_ID, label: HEALTH_CHECK_JOB_LABEL, running: false, lastRunAt: null, lastFinishedAt: null, nextRunAt: null, lastStatus: null, message: null } } : {}),
  };
}
beforeEach(() => {
  queryClient.clear(); vi.resetAllMocks();
  Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
  window.history.replaceState({}, '', '/');
  vi.mocked(api.session).mockResolvedValue(session);
  vi.mocked(api.integrations.list).mockResolvedValue(INTEGRATIONS.map(def => fixture(def.id)));
  vi.mocked(api.integrations.detail).mockImplementation(async id => fixture(id));
  vi.mocked(api.integrations.logs).mockResolvedValue([]);
  vi.mocked(api.integrations.test).mockResolvedValue({ state: 'ok', message: 'Conexão válida de teste', checkedAt: '2026-10-16T10:00:00.000Z', latencyMs: 10 });
});
function setup(path = '/') {
  window.history.replaceState({}, '', path);
  render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
  return userEvent.setup();
}
describe('layout e navegação', () => {
  it('tem somente Início e Integrações no menu, marca ativo e navega preservando layout', async () => {
    const user = setup();
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    expect(within(nav).getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page');
    await user.click(within(nav).getByRole('link', { name: 'Integrações' }));
    expect(await screen.findByRole('heading', { name: 'Integrações' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Início' }).hasAttribute('aria-current')).toBe(false);
    expect(within(nav).getByRole('link', { name: 'Integrações' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByRole('link', { name: /Pusher/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^OpenCode/ })).toBeNull();
  });
  it('abre drawer mobile, torna conteúdo inerte, fecha por Esc e restaura foco', async () => {
    window.innerWidth = 390;
    const user = setup();
    const menu = await screen.findByRole('button', { name: 'Abrir menu' });
    await user.click(menu);
    expect(await screen.findByRole('dialog', { name: 'Menu principal' })).toBeTruthy();
    expect(screen.getByRole('main', { hidden: true }).parentElement?.hasAttribute('inert')).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(menu));
    await user.click(menu);
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Integrações' }));
    expect(await screen.findByRole('heading', { name: 'Integrações' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
describe('configuração de integrações', () => {
  it('trata erro de listagem com retry e mantém página sem dados fictícios', async () => {
    vi.mocked(api.integrations.list).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    const user = setup('/integracoes');
    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhuma integração disponível.')).toBeTruthy();
  });
  it('edita público e segredo como somente escrita, preserva rascunho durante polling e salva', async () => {
    const user = setup('/integracoes/pusher');
    const appId = await screen.findByLabelText(/^App ID/);
    await user.type(appId, 'test-app-id');
    await user.click(screen.getByRole('button', { name: 'Definir' }));
    await user.type(await screen.findByLabelText(/^Secret/), 'fixture-secret-value');
    queryClient.setQueryData(['integrations', 'pusher'], { ...fixture('pusher'), updatedAt: '2026-10-16T10:00:00.000Z' });
    expect((screen.getByLabelText(/^App ID/) as HTMLInputElement).value).toBe('test-app-id');
    vi.mocked(api.integrations.save).mockImplementation(async (_id, input) => {
      const saved = { ...fixture('pusher'), version: 1, publicValues: input.publicValues, secrets: { secret: { configured: true, unreadable: false } } };
      vi.mocked(api.integrations.detail).mockResolvedValue(saved);
      return saved;
    });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.integrations.save).toHaveBeenCalledWith('pusher', expect.objectContaining({ version: 0, publicValues: expect.objectContaining({ appId: 'test-app-id' }), secrets: { secret: { action: 'set', value: 'fixture-secret-value' } } })));
    expect(await screen.findByText('Configurado', { exact: true })).toBeTruthy();
    expect(screen.queryByDisplayValue('fixture-secret-value')).toBeNull();
  });
  it('bloqueia segredo sem chave e mostra aviso; segredo configurado não aparece em input', async () => {
    vi.mocked(api.integrations.detail).mockResolvedValue({ ...fixture('pusher'), encryptionKeyConfigured: false, secrets: { secret: { configured: true, unreadable: true } } });
    setup('/integracoes/pusher');
    expect(await screen.findByText(/Chave de criptografia ausente no servidor \(INTEGRATIONS_ENCRYPTION_KEY\)/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Chave de criptografia ausente no servidor' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/O valor salvo não pôde ser lido/)).toBeTruthy();
  });
  it('solicita confirmação para descartar rascunho ao navegar', async () => {
    const user = setup('/integracoes/smtp');
    await user.type(await screen.findByLabelText(/^Host/), 'smtp.example.test');
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Início' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect((screen.getByLabelText(/^Host/) as HTMLInputElement).value).toBe('smtp.example.test');
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Início' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeTruthy();
  });
  it('mostra somente configuração dos provedores sem módulos de negócio do Opex', async () => {
    setup('/integracoes/ia');
    expect(await screen.findByRole('link', { name: /OpenCode/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Gemini/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /JEV/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Tarefas|Consumo|Agentes/ })).toBeNull();
  });
  it('testa conexão apenas por ação explícita e apresenta resultado seguro', async () => {
    const user = setup('/integracoes');
    const row = (await screen.findByRole('link', { name: /Pusher/ })).closest('li')!;
    expect(api.integrations.test).not.toHaveBeenCalled();
    await user.click(within(row).getByRole('button', { name: 'Testar conexão' }));
    expect(await screen.findByText(/Conexão válida de teste/)).toBeTruthy();
    expect(api.integrations.test).toHaveBeenCalledWith('pusher');
  });
  it('mostra rotina e dispara execução manual, sem salvar nem ativar agendador', async () => {
    vi.mocked(api.integrations.runHealthCheck).mockResolvedValue({ ...fixture('crons').cronState!, lastStatus: 'ok', message: 'Concluída' });
    const user = setup('/integracoes/crons');
    expect((await screen.findByLabelText('Agendador ativo') as HTMLInputElement).checked).toBe(false);
    await user.click(screen.getByRole('tab', { name: 'Rotinas' }));
    await user.click(await screen.findByRole('button', { name: `Executar agora: ${HEALTH_CHECK_JOB_LABEL}` }));
    expect(api.integrations.runHealthCheck).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Executar agora' }));
    await waitFor(() => expect(api.integrations.runHealthCheck).toHaveBeenCalledOnce());
    expect(api.integrations.save).not.toHaveBeenCalled();
    expect((screen.getByLabelText(`Ativar ${HEALTH_CHECK_JOB_LABEL}`) as HTMLInputElement).checked).toBe(false);
  });
});

describe('regressões de fidelidade ao Opex', () => {
  it('Pusher usa radiogroup segmentado e preserva campos condicionais ao alternar conexão', async () => {
    const user = setup('/integracoes/pusher');
    const group = await screen.findByRole('radiogroup', { name: /^Conexão/ });
    expect(screen.queryByRole('combobox', { name: 'Conexão' })).toBeNull();
    expect(within(group).getByRole('radio', { name: 'Cluster' }).getAttribute('aria-checked')).toBe('true');
    await user.type(screen.getByLabelText(/^Cluster público/), 'sa1-client');
    await user.click(within(group).getByRole('radio', { name: 'Host' }));
    expect(await screen.findByPlaceholderText('http://soketi:6001')).toBeTruthy();
    expect(screen.getByPlaceholderText('ws://192.168.0.64:6001, wss://dominio.com.br/prefixo/soketi')).toBeTruthy();
    expect(screen.getByText('Usada pelo servidor do app para publicar eventos')).toBeTruthy();
    await user.click(within(group).getByRole('radio', { name: 'Cluster' }));
    expect((await screen.findByLabelText(/^Cluster público/ ) as HTMLInputElement).value).toBe('sa1-client');
  });
  it('não limita largura nem inventa ações textuais no cabeçalho, e usa grade ímpar do Opex', async () => {
    setup('/integracoes/pusher');
    const form = await screen.findByRole('form', { name: 'Configuração de Pusher' });
    expect(form.parentElement?.className).toBe('grid items-start gap-6');
    expect(screen.queryByRole('button', { name: 'Testar conexão' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Logs de debug' })).toBeNull();
    const card = screen.getByText('Campos públicos').closest('[class*="rounded"]')!;
    expect(card.querySelector('[class*="last-child:nth-child(odd)"]')).toBeTruthy();
    const define = screen.getByRole('button', { name: 'Definir' });
    expect(define.textContent).toBe('');
    expect(screen.queryByText('Definir Secret')).toBeNull();
    expect(api.integrations.test).not.toHaveBeenCalled();
  });
  it('hub IA tem um único h1, aba Provedores e card de provedores antes de Geral', async () => {
    setup('/integracoes/ia');
    expect(await screen.findByRole('heading', { level: 1, name: 'Provedores de IA' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Provedores' }).getAttribute('aria-selected')).toBe('true');
    const providers = await screen.findByText('Configure cada provedor na própria página.');
    const general = screen.getByText('Geral', { exact: true });
    expect(Boolean(providers.compareDocumentPosition(general) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
  it.each(['opencode', 'gemini', 'jev'])('provedor %s mantém configuração, Geral/privados/públicos na ordem da referência', async provider => {
    setup(`/integracoes/ia/${provider}`);
    await screen.findByRole('tab', { name: 'Configuração' });
    const general = screen.getByText('Geral', { exact: true });
    const secrets = screen.getByText('Campos privados');
    expect(Boolean(general.compareDocumentPosition(secrets) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    if (provider === 'opencode') {
      expect(Boolean(secrets.compareDocumentPosition(screen.getByText('Campos públicos')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      expect(screen.getByPlaceholderText('http://127.0.0.1:4096')).toBeTruthy();
      expect(screen.getByPlaceholderText('/home/usuario/opex-ia')).toBeTruthy();
    }
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
  it('desfazer fecha o input privado sem revelar o valor salvo', async () => {
    const user = setup('/integracoes/pusher');
    await user.click(await screen.findByRole('button', { name: 'Definir' }));
    const input = await screen.findByPlaceholderText('Novo valor para secret');
    await user.type(input, 'fixture-only-secret');
    const form = screen.getByRole('form');
    await user.click(within(form).getAllByRole('button', { name: 'Desfazer' }).at(-1)!);
    await waitFor(() => expect(screen.queryByDisplayValue('fixture-only-secret')).toBeNull());
    expect(screen.getByRole('button', { name: 'Definir' })).toBeTruthy();
  });
  it('Crons confirma descarte ao mudar aba e mantém rotina recolhida com busca e intervalo', async () => {
    const user = setup('/integracoes/crons');
    await user.click(await screen.findByLabelText('Agendador ativo'));
    await user.click(screen.getByRole('tab', { name: 'Rotinas' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    const expand = await screen.findByRole('button', { name: HEALTH_CHECK_JOB_LABEL });
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByLabelText('Intervalo')).toBeNull();
    await user.click(expand);
    expect((await screen.findByLabelText('Intervalo') as HTMLInputElement).value).toBe('5');
    await user.type(screen.getByPlaceholderText('Buscar rotina'), 'inexistente');
    expect(await screen.findByText('Nenhuma rotina encontrada')).toBeTruthy();
  });
  it('debug usa segunda coluna apenas quando salvo ativo, sem chamar serviços ao abrir', async () => {
    vi.mocked(api.integrations.detail).mockResolvedValue({ ...fixture('pusher'), debugMode: true });
    setup('/integracoes/pusher');
    expect(await screen.findByTestId('integration-debug-panel')).toBeTruthy();
    expect(screen.getByTestId('integration-editor-grid').className).toContain('xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
    expect(screen.getByRole('button', { name: 'Testar conexão' }).textContent).toBe('');
    expect(api.integrations.test).not.toHaveBeenCalled();
  });
});
