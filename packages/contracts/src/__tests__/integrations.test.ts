import { describe, expect, it } from 'vitest';
import { INTEGRATIONS, fieldVisible, integrationPatchSchema, integrationPath, integrationValuesSchema } from '../index';

describe('contratos e catálogo de integrações', () => {
  it('mantém seis raízes, três filhos e rotas coerentes', () => {
    expect(INTEGRATIONS.filter(def => !def.parent)).toHaveLength(6);
    expect(INTEGRATIONS.filter(def => def.parent === 'ai')).toHaveLength(3);
    expect(integrationPath('ai')).toBe('/integracoes/ia');
    expect(integrationPath('ai_gemini')).toBe('/integracoes/ia/gemini');
    expect(integrationPath('smtp')).toBe('/integracoes/smtp');
  });
  it('valida tipos, limites, URLs e chaves por integração', () => {
    expect(integrationValuesSchema('smtp').safeParse({ port: 65536 }).success).toBe(false);
    expect(integrationValuesSchema('crons').safeParse({ intervalMinutes: 0 }).success).toBe(false);
    expect(integrationValuesSchema('crons').safeParse({ schedulerEnabled: 'true' }).success).toBe(false);
    expect(integrationValuesSchema('storage_s3').safeParse({ endpoint: 'https://s3.example.test' }).success).toBe(true);
    for (const endpoint of ['file:///etc/passwd', 'https://user:pass@example.test', 'https://example.test/path', 'https://example.test?token=key']) expect(integrationValuesSchema('storage_s3').safeParse({ endpoint }).success).toBe(false);
    expect(integrationValuesSchema('smtp').safeParse({ apiKey: 'fixture' }).success).toBe(false);
  });
  it('diferencia omissão e remoção de segredos e não aceita set vazio', () => {
    const common = { version: 0, environment: 'interno', debugMode: false, publicValues: {} };
    expect(integrationPatchSchema.safeParse({ ...common, secrets: { secret: { action: 'set', value: '' } } }).success).toBe(false);
    expect(integrationPatchSchema.parse({ ...common, secrets: { secret: { action: 'clear' } } }).secrets).toEqual({ secret: { action: 'clear' } });
    expect(integrationPatchSchema.parse({ ...common, secrets: {} }).secrets).toEqual({});
    const host = INTEGRATIONS[0]!.fields.find(field => field.key === 'url')!;
    expect(fieldVisible(host, { mode: 'cluster' })).toBe(false);
    expect(fieldVisible(host, { mode: 'host' })).toBe(true);
  });
  it('valida o seletor segmentado e URLs públicas Pusher sem relaxar os endereços do servidor', () => {
    const pusher = INTEGRATIONS.find(def => def.id === 'pusher')!;
    expect(pusher.fields.find(field => field.key === 'mode')?.kind).toBe('segmented');
    expect(integrationValuesSchema('pusher').safeParse({ mode: 'invalid' }).success).toBe(false);
    expect(integrationValuesSchema('pusher').safeParse({ clientUrl: 'ws://192.168.0.64:6001, wss://dominio.com.br/prefixo/soketi' }).success).toBe(true);
    for (const clientUrl of ['file:///etc/passwd', 'wss://user:pass@example.test', 'wss://example.test?token=secret', 'wss://example.test,']) expect(integrationValuesSchema('pusher').safeParse({ clientUrl }).success).toBe(false);
    expect(integrationValuesSchema('pusher').safeParse({ url: 'ws://server:6001' }).success).toBe(false);
    expect(integrationValuesSchema('pusher').safeParse({ url: 'http://server:6001/proxy' }).success).toBe(false);
  });
});
