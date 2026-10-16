import { z } from 'zod';

export const integrationIdSchema = z.enum(['pusher', 'internal_api', 'crons', 'ai', 'ai_opencode', 'ai_gemini', 'ai_jev', 'smtp', 'storage_s3']);
export type IntegrationId = z.infer<typeof integrationIdSchema>;
export type PublicValue = string | number | boolean;
export interface IntegrationField {
  key: string; label: string; kind: 'text' | 'url' | 'number' | 'boolean' | 'select' | 'segmented';
  defaultValue?: PublicValue; required?: boolean; min?: number; max?: number;
  options?: readonly string[]; optionLabels?: Readonly<Record<string, string>>;
  visibleWhen?: { field: string; equals: string }; description?: string; placeholder?: string; unit?: string; pusherClientUrls?: boolean;
}
export interface IntegrationDefinition {
  id: IntegrationId; name: string; description: string; parent?: 'ai'; environment: 'interno' | 'externo';
  fields: readonly IntegrationField[]; secrets: readonly { key: string; label: string; required?: boolean; description?: string }[];
}
export const HEALTH_CHECK_JOB_ID = 'integrations-health-check';
export const HEALTH_CHECK_JOB_LABEL = 'Verificação de status das integrações';
export const INTEGRATIONS: readonly IntegrationDefinition[] = [
  { id: 'pusher', name: 'Pusher', description: 'Eventos em tempo real para as telas do app', environment: 'externo', fields: [
    { key: 'mode', label: 'Conexão', kind: 'segmented', options: ['cluster', 'host'], optionLabels: { cluster: 'Cluster', host: 'Host' }, defaultValue: 'cluster', required: true, description: 'Cluster do Pusher na nuvem ou servidor próprio compatível (ex.: Soketi)' },
    { key: 'appId', label: 'App ID', kind: 'text', required: true }, { key: 'key', label: 'Key', kind: 'text', required: true },
    { key: 'cluster', label: 'Cluster', kind: 'text', defaultValue: 'sa1', required: true, visibleWhen: { field: 'mode', equals: 'cluster' } },
    { key: 'url', label: 'URL do servidor', kind: 'url', required: true, placeholder: 'http://soketi:6001', description: 'Usada pelo servidor do app para publicar eventos', visibleWhen: { field: 'mode', equals: 'host' } },
    { key: 'clientKey', label: 'Key pública do cliente', kind: 'text', description: 'Vazio usa a mesma Key do servidor' },
    { key: 'clientCluster', label: 'Cluster público do cliente', kind: 'text', description: 'Vazio usa o mesmo cluster do servidor', visibleWhen: { field: 'mode', equals: 'cluster' } },
    { key: 'clientUrl', label: 'URL pública do cliente', kind: 'url', placeholder: 'ws://192.168.0.64:6001, wss://dominio.com.br/prefixo/soketi', pusherClientUrls: true, visibleWhen: { field: 'mode', equals: 'host' }, description: 'Usada pelo navegador; vazio usa a URL do servidor. Vários endereços separados por vírgula (ex.: IP e domínio): vale o de mesmo host da página. Aceita caminho de proxy' },
  ], secrets: [{ key: 'secret', label: 'Secret', required: true }] },
  { id: 'internal_api', name: 'API interna', description: 'Backend NestJS: disponibilidade e documentação OpenAPI', environment: 'interno', fields: [], secrets: [] },
  { id: 'crons', name: 'Crons', description: 'Rotinas agendadas executadas pelo próprio backend', environment: 'interno', fields: [
    { key: 'schedulerEnabled', label: 'Agendador ativo', description: 'Desligado, nenhuma rotina é disparada', kind: 'boolean', defaultValue: false },
    { key: 'jobEnabled', label: HEALTH_CHECK_JOB_LABEL, kind: 'boolean', defaultValue: false },
    { key: 'intervalMinutes', label: 'Intervalo (minutos)', kind: 'number', min: 1, max: 1440, defaultValue: 5 },
  ], secrets: [] },
  { id: 'ai', name: 'Provedores de IA', description: 'Configuração dos provedores OpenCode, Gemini e JEV', environment: 'externo', fields: [], secrets: [] },
  { id: 'ai_opencode', name: 'OpenCode', description: 'Servidor OpenCode 2.x: modelos e agentes das suas contas e assinaturas', parent: 'ai', environment: 'interno', fields: [
    { key: 'baseUrl', label: 'URL do servidor', kind: 'url', required: true, placeholder: 'http://127.0.0.1:4096', description: 'Endereço do opencode serve (2.x) que o servidor do app alcança. Em Docker, use o IP do host, não 127.0.0.1' },
    { key: 'directory', label: 'Diretório das sessões', kind: 'text', placeholder: '/home/usuario/opex-ia', description: 'Pasta (na máquina do OpenCode, precisa existir) em que as sessões do app são criadas; vazio usa a do servidor' },
  ], secrets: [{ key: 'password', label: 'Senha do servidor', required: true, description: 'OPENCODE_PASSWORD do opencode serve (usuário opencode, autenticação Basic)' }] },
  { id: 'ai_gemini', name: 'Gemini', description: 'Modelos Google Gemini pela API do Google AI Studio', parent: 'ai', environment: 'externo', fields: [], secrets: [{ key: 'apiKey', label: 'API key', required: true, description: 'Chave do Google AI Studio (aistudio.google.com/apikey)' }] },
  { id: 'ai_jev', name: 'JEV', description: 'Modelo TypeSafe (JEV) de decisão estruturada, não de geração de texto', parent: 'ai', environment: 'externo', fields: [], secrets: [{ key: 'apiKey', label: 'API key', required: true, description: 'Chave da TypeSafe (console.typesafe.ai/keys)' }] },
  { id: 'smtp', name: 'SMTP', description: 'Envio de e-mails transacionais', environment: 'interno', fields: [
    { key: 'host', label: 'Host', kind: 'text', required: true },
    { key: 'port', label: 'Porta', kind: 'number', min: 1, max: 65535, defaultValue: 587, required: true },
    { key: 'user', label: 'Usuário', kind: 'text' }, { key: 'from', label: 'Remetente', kind: 'text', placeholder: 'Shekinah <nao-responda@exemplo.com>' },
  ], secrets: [{ key: 'password', label: 'Senha' }] },
  { id: 'storage_s3', name: 'Storage S3', description: 'Armazenamento de arquivos em MinIO/S3 compatível', environment: 'interno', fields: [
    { key: 'endpoint', label: 'Endpoint', kind: 'url', required: true },
    { key: 'publicEndpoint', label: 'Endpoint público (navegador)', kind: 'url', placeholder: 'http://localhost:9000', description: 'Endereço do storage visto pelo navegador, usado nas URLs assinadas de upload e mídia. Preencha quando o Endpoint for um nome interno (ex.: container Docker). Vazio = usa o Endpoint.' },
    { key: 'region', label: 'Região', kind: 'text', defaultValue: 'us-east-1', required: true },
    { key: 'bucket', label: 'Bucket', kind: 'text', required: true },
    { key: 'signedUrlExpiresSeconds', label: 'Expiração da URL assinada', unit: 's', kind: 'number', min: 60, max: 604800, defaultValue: 3600 },
  ], secrets: [{ key: 'accessKey', label: 'Access key', required: true }, { key: 'secretKey', label: 'Secret key', required: true }] },
];
export function integrationDefinition(id: IntegrationId): IntegrationDefinition {
  return INTEGRATIONS.find(def => def.id === id)!;
}
export function fieldVisible(field: IntegrationField, values: Record<string, PublicValue>) {
  return !field.visibleWhen || values[field.visibleWhen.field] === field.visibleWhen.equals;
}
export const integrationPath = (id: IntegrationId) => `/integracoes/${id === 'ai' ? 'ia' : id.startsWith('ai_') ? `ia/${id.slice(3)}` : id}`;
const publicValueSchema = z.union([z.string().max(2000), z.number().finite(), z.boolean()]);
export const secretActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set'), value: z.string().min(1).max(4096) }).strict(),
  z.object({ action: z.literal('clear') }).strict(),
]);
export const integrationPatchSchema = z.object({
  version: z.number().int().nonnegative(), environment: z.enum(['interno', 'externo']), debugMode: z.boolean(),
  publicValues: z.record(z.string(), publicValueSchema), secrets: z.record(z.string(), secretActionSchema),
}).strict();
export type IntegrationPatch = z.infer<typeof integrationPatchSchema>;
const httpOrigin = z.string().max(2000).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'; }
  catch { return false; }
}, 'Use uma origem HTTP(S), sem caminho, credenciais ou parâmetros.');
export function integrationValuesSchema(id: IntegrationId) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of integrationDefinition(id).fields) {
    shape[field.key] = field.kind === 'boolean' ? z.boolean() : field.kind === 'number'
      ? z.number().int().min(field.min ?? 0).max(field.max ?? Number.MAX_SAFE_INTEGER)
      : field.pusherClientUrls ? z.string().max(2000).refine(value => !value || value.split(',').every(part => {
        try { const url = new URL(part.trim()); return ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash; }
        catch { return false; }
      }), 'Use endereços HTTP(S) ou WS(S), separados por vírgula, sem credenciais ou parâmetros.')
      : field.kind === 'url' ? httpOrigin
      : field.kind === 'select' || field.kind === 'segmented' ? z.enum(field.options as [string, ...string[]])
      : z.string().trim().max(2000).refine(value => !/[\r\n\0]/.test(value), 'Caracteres inválidos.');
  }
  return z.object(shape).strict().partial();
}
export const integrationHealthSchema = z.object({
  state: z.enum(['unknown', 'ok', 'error', 'not_configured', 'disabled']),
  message: z.string(), checkedAt: z.iso.datetime().nullable(), latencyMs: z.number().nonnegative().nullable(),
});
export type IntegrationHealth = z.infer<typeof integrationHealthSchema>;
export const cronStateSchema = z.object({
  id: z.literal(HEALTH_CHECK_JOB_ID), label: z.string(), running: z.boolean(), nextRunAt: z.iso.datetime().nullable(),
  lastRunAt: z.iso.datetime().nullable(), lastFinishedAt: z.iso.datetime().nullable(),
  lastStatus: z.enum(['ok', 'error']).nullable(), message: z.string().nullable(),
});
export type CronState = z.infer<typeof cronStateSchema>;
export const integrationSchema = z.object({
  id: integrationIdSchema, name: z.string(), description: z.string(), parent: z.literal('ai').optional(),
  environment: z.enum(['interno', 'externo']), debugMode: z.boolean(), version: z.number().int(),
  publicValues: z.record(z.string(), publicValueSchema),
  secrets: z.record(z.string(), z.object({ configured: z.boolean(), unreadable: z.boolean() })),
  configured: z.boolean(), encryptionKeyConfigured: z.boolean(), updatedAt: z.iso.datetime().nullable(),
  health: integrationHealthSchema, cronState: cronStateSchema.optional(),
});
export type Integration = z.infer<typeof integrationSchema>;
export const integrationLogSchema = z.object({ at: z.iso.datetime(), level: z.enum(['info', 'error']), message: z.string(), source: z.enum(['manual', 'scheduler']) });
export type IntegrationLog = z.infer<typeof integrationLogSchema>;
