import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { INTEGRATIONS, fieldVisible, integrationDefinition, integrationIdSchema, integrationPatchSchema, integrationValuesSchema,
  type Integration, type IntegrationHealth, type IntegrationId, type PublicValue } from '@shekinah/contracts';
import { CONFIG, type AppConfig } from '../../config.js';
import { createLogger } from '../../logger.js';
import { openapi } from '../../openapi.js';
import { CheckFailure, ConnectionChecker, CHECK_TIMEOUT_MS } from './connection-checker.js';
import type { DebugRecord, IntegrationRecord } from './integration.schema.js';
import { encryptionKey, openSecret, sealSecret } from './secret-box.js';

const unknownHealth: IntegrationHealth = { state: 'unknown', message: 'Ainda não verificada.', checkedAt: null, latencyMs: null };
@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly key;
  private readonly logger;
  constructor(
    @InjectModel('IntegrationRecord') private readonly records: Model<IntegrationRecord>,
    @InjectModel('IntegrationDebug') private readonly debug: Model<DebugRecord>,
    @InjectConnection() private readonly connection: Connection,
    @Inject(CONFIG) config: AppConfig,
    @Inject(ConnectionChecker) private readonly checker: ConnectionChecker,
  ) { this.key = encryptionKey(config.INTEGRATIONS_ENCRYPTION_KEY); this.logger = createLogger(config.LOG_LEVEL); }
  async onModuleInit() { await Promise.all([this.records.init(), this.debug.init()]); }
  id(value: string): IntegrationId {
    const result = integrationIdSchema.safeParse(value);
    if (!result.success) throw new NotFoundException('Integração não encontrada.');
    return result.data;
  }
  async ensure(id: IntegrationId) {
    const def = integrationDefinition(id);
    try { await this.records.updateOne({ id }, { $setOnInsert: { environment: def.environment } }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  }
  async resolved(id: IntegrationId) {
    const record = await this.records.findOne({ id }).select('+secrets').lean();
    const def = integrationDefinition(id);
    const values: Record<string, PublicValue> = Object.fromEntries(def.fields.map(field => [field.key, field.defaultValue ?? (field.kind === 'boolean' ? false : '')]));
    Object.assign(values, record?.publicValues ?? {});
    const secrets: Record<string, string> = {};
    const state: Integration['secrets'] = {};
    for (const field of def.secrets) {
      const sealed = record?.secrets?.[field.key];
      let unreadable = false;
      if (sealed) {
        try { if (!this.key) throw new Error(); secrets[field.key] = openSecret(sealed, this.key, `${id}:${field.key}`); }
        catch { unreadable = true; }
      }
      state[field.key] = { configured: Boolean(sealed), unreadable };
    }
    let configured = def.fields.filter(field => field.required && fieldVisible(field, values)).every(field => values[field.key] !== '')
      && def.secrets.filter(field => field.required).every(field => Boolean(secrets[field.key]));
    if (id === 'smtp' && values.user && !secrets.password) configured = false;
    return { record, values, secrets, state, configured };
  }
  async detail(id: IntegrationId): Promise<Integration> {
    const def = integrationDefinition(id);
    const { record, values, state, configured: ownConfigured } = await this.resolved(id);
    const children = id === 'ai' ? await Promise.all(INTEGRATIONS.filter(def => def.parent === 'ai').map(def => this.detail(def.id))) : [];
    const configured = id === 'ai' ? children.some(value => value.configured) : ownConfigured;
    let health = !configured ? { ...unknownHealth, state: 'not_configured' as const, message: 'Configuração incompleta ou segredo ilegível.' } : record?.health ?? unknownHealth;
    if (id === 'ai' && configured) {
      const active = children.filter(child => child.configured);
      const failed = active.some(child => child.health.state === 'error');
      const unknown = active.some(child => child.health.state === 'unknown');
      health = { ...unknownHealth, state: failed ? 'error' : unknown ? 'unknown' : 'ok',
        message: failed ? 'Um ou mais provedores configurados estão indisponíveis.' : unknown ? 'Existem provedores ainda não verificados.' : `${active.length} provedor(es) conectado(s).`,
        checkedAt: active.every(child => child.health.checkedAt) ? new Date(Math.min(...active.map(child => Date.parse(child.health.checkedAt!)))).toISOString() : null,
      };
    }
    return { id, name: def.name, description: def.description, ...(def.parent ? { parent: def.parent } : {}),
      environment: record?.environment ?? def.environment, debugMode: record?.debugMode ?? false, version: record?.version ?? 0,
      publicValues: values, secrets: state, configured, encryptionKeyConfigured: Boolean(this.key), updatedAt: record?.updatedAt?.toISOString() ?? null,
      health,
    };
  }
  list() { return Promise.all(INTEGRATIONS.map(def => this.detail(def.id))); }
  async save(id: IntegrationId, body: unknown, actor: string) {
    const parsed = integrationPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Configuração inválida.');
    const input = parsed.data;
    const def = integrationDefinition(id);
    const values = integrationValuesSchema(id).safeParse(input.publicValues);
    if (!values.success || Object.keys(input.secrets).some(key => !def.secrets.some(field => field.key === key))) throw new BadRequestException('Campos inválidos para esta integração.');
    await this.ensure(id);
    const { record } = await this.resolved(id);
    const secrets = { ...record?.secrets };
    for (const [key, action] of Object.entries(input.secrets)) {
      if (action.action === 'clear') delete secrets[key];
      else {
        if (!this.key) throw new ConflictException('Configure INTEGRATIONS_ENCRYPTION_KEY no backend para gravar segredos.');
        secrets[key] = sealSecret(action.value, this.key, `${id}:${key}`);
      }
    }
    const changedFields = [...Object.keys(input.publicValues), ...Object.keys(input.secrets), 'environment', 'debugMode'];
    const result = await this.records.updateOne({ id, version: input.version }, {
      $set: { publicValues: { ...record?.publicValues, ...values.data }, secrets, environment: input.environment, debugMode: input.debugMode, updatedAt: new Date(), health: null },
      $inc: { version: 1 }, $push: { audit: { $each: [{ at: new Date(), actor, action: 'configuration.updated', fields: changedFields }], $slice: -200 } },
    });
    if (!result.modifiedCount) throw new ConflictException('Esta configuração foi alterada. Recarregue antes de salvar.');
    this.logger.info({ event: 'integration.updated', integrationId: id, actor, fields: changedFields }, 'Configuração de integração alterada');
    return this.detail(id);
  }
  async logs(id: IntegrationId) {
    return (await this.debug.find({ integrationId: id, at: { $gte: new Date(Date.now() - 172800000) } }).sort({ at: -1 }).limit(100).lean())
      .map(log => ({ at: log.at.toISOString(), level: log.level, source: log.source, message: log.message }));
  }
  async check(id: IntegrationId, source: 'manual' | 'scheduler', actor: string): Promise<IntegrationHealth> {
    await this.ensure(id);
    const snapshot = await this.detail(id);
    const { values, secrets } = await this.resolved(id);
    const started = Date.now();
    let health: IntegrationHealth = { ...unknownHealth, checkedAt: new Date().toISOString(), latencyMs: 0 };
    try {
      if (!snapshot.configured) health = { ...health, state: 'not_configured', message: 'Configuração incompleta ou segredo ilegível.' };
      else if (id === 'crons' && !values.schedulerEnabled) health = { ...health, state: 'disabled', message: 'Agendador desativado.' };
      else {
        let message: string;
        if (id === 'internal_api') {
          // This verifier executes inside Nest, validates its DB and the actual published contract. No self-HTTP credential bypass.
          await this.connection.db!.admin().ping();
          if (!openapi.openapi.startsWith('3.') || !openapi.paths['/me']) throw new CheckFailure('Contrato OpenAPI indisponível.');
          message = 'NestJS ativo, MongoDB acessível e contrato OpenAPI 3.x disponível.';
        } else if (id === 'crons') message = 'Agendador ativo. Consulte o estado das rotinas.';
        else if (id === 'ai') {
          const children = await Promise.all(INTEGRATIONS.filter(def => def.parent === 'ai').map(def => this.check(def.id, source, actor)));
          const configured = children.filter(health => health.state !== 'not_configured');
          if (configured.some(health => health.state === 'error')) throw new CheckFailure('Um ou mais provedores configurados estão indisponíveis.');
          message = `${configured.length} provedor(es) conectado(s).`;
        } else {
          const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS);
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            message = await Promise.race([this.checker.check(id, values, secrets, signal), new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new CheckFailure('Tempo limite de verificação excedido.')), CHECK_TIMEOUT_MS);
            })]);
          } finally { if (timer) clearTimeout(timer); }
        }
        health = { ...health, state: 'ok', message };
      }
    } catch (error) {
      health = { ...health, state: 'error', message: error instanceof CheckFailure ? error.message : 'Falha de conexão ou autenticação. Confira endereço, rede e credenciais.' };
    }
    health.latencyMs = Date.now() - started;
    // A test from an old configuration must never overwrite the status of a newer one.
    const result = await this.records.updateOne({ id, version: snapshot.version }, {
      $set: { health }, $push: { audit: { $each: [{ at: new Date(), actor, action: `connection.checked.${source}`, fields: [] }], $slice: -200 } },
    });
    if (!result.modifiedCount) throw new ConflictException('Configuração alterada durante a verificação. Teste novamente.');
    if (snapshot.debugMode) await this.debug.create({ integrationId: id, at: new Date(), level: health.state === 'error' ? 'error' : 'info', message: health.message, source });
    return health;
  }
}
