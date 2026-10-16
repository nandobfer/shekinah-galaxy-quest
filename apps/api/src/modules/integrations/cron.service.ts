import { ConflictException, Inject, Injectable, OnModuleInit, OnApplicationBootstrap, BeforeApplicationShutdown } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { HEALTH_CHECK_JOB_ID, HEALTH_CHECK_JOB_LABEL, type CronState } from '@shekinah/contracts';
import type { CronRecord } from './integration.schema.js';
import { IntegrationsService } from './integrations.service.js';
import { createLogger } from '../../logger.js';
import { CONFIG, type AppConfig } from '../../config.js';

export const JOB_LEASE_MS = 120_000;
@Injectable()
export class CronService implements OnModuleInit, OnApplicationBootstrap, BeforeApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private closing = false;
  private active = new Set<Promise<unknown>>();
  private readonly logger;
  constructor(@InjectModel('CronRecord') private readonly states: Model<CronRecord>,
    @Inject(IntegrationsService) private readonly integrations: IntegrationsService, @Inject(CONFIG) private readonly config: AppConfig) {
    this.logger = createLogger(config.LOG_LEVEL);
  }
  async onModuleInit() {
    await this.states.init();
    try { await this.states.updateOne({ id: HEALTH_CHECK_JOB_ID }, { $setOnInsert: { scheduleVersion: -1 } }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  }
  onApplicationBootstrap() {
    if (this.config.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      const task = this.run(false, 'scheduler').catch(() => this.logger.error({ event: 'cron.tick.failed' }, 'Falha no tick do agendador'));
      this.track(task);
    }, 15_000);
    this.timer.unref();
  }
  private track<T>(task: Promise<T>): Promise<T> {
    this.active.add(task);
    void task.finally(() => this.active.delete(task)).catch(() => undefined);
    return task;
  }
  async beforeApplicationShutdown() {
    this.closing = true; if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.active]);
  }
  async sync(now = new Date()) {
    const config = await this.integrations.detail('crons');
    const enabled = Boolean(config.publicValues.schedulerEnabled && config.publicValues.jobEnabled);
    await this.states.updateOne({ id: HEALTH_CHECK_JOB_ID, scheduleVersion: { $lt: config.version } }, {
      $set: { scheduleVersion: config.version, nextRunAt: enabled ? new Date(now.getTime() + Number(config.publicValues.intervalMinutes) * 60_000) : null },
    });
    return config;
  }
  async state(): Promise<CronState> {
    const record = await this.states.findOne({ id: HEALTH_CHECK_JOB_ID }).lean();
    return { id: HEALTH_CHECK_JOB_ID, label: HEALTH_CHECK_JOB_LABEL, running: Boolean(record?.lockedUntil && record.lockedUntil > new Date()),
      nextRunAt: record?.nextRunAt?.toISOString() ?? null, lastRunAt: record?.lastRunAt?.toISOString() ?? null,
      lastFinishedAt: record?.lastFinishedAt?.toISOString() ?? null, lastStatus: record?.lastStatus ?? null, message: record?.message ?? null };
  }
  run(manual: boolean, actor: string, now = new Date()) { return this.track(this.execute(manual, actor, now)); }
  private async execute(manual: boolean, actor: string, now: Date) {
    if (this.closing) throw new ConflictException('O servidor está encerrando.');
    const config = await this.sync(now);
    if (!manual && !(config.publicValues.schedulerEnabled && config.publicValues.jobEnabled)) return this.state();
    const owner = randomUUID();
    const claimed = await this.states.findOneAndUpdate({ id: HEALTH_CHECK_JOB_ID,
      scheduleVersion: config.version,
      ...(manual ? {} : { nextRunAt: { $lte: now } }),
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
    }, { $set: { lockedUntil: new Date(now.getTime() + JOB_LEASE_MS), lockedBy: owner, lastRunAt: now,
      nextRunAt: config.publicValues.schedulerEnabled && config.publicValues.jobEnabled ? new Date(now.getTime() + Number(config.publicValues.intervalMinutes) * 60_000) : null,
    } }, { returnDocument: 'after' });
    if (!claimed) {
      if (manual) throw new ConflictException('Esta rotina já está em execução.');
      return this.state();
    }
    let failed = 0;
    try {
      // AI checks its configured children. Crons is intentionally excluded: no recursive scheduler checks.
      const results = await Promise.allSettled(['pusher', 'internal_api', 'ai', 'smtp', 'storage_s3'].map(id => this.integrations.check(this.integrations.id(id), manual ? 'manual' : 'scheduler', actor)));
      failed = results.filter(result => result.status === 'rejected' || result.value.state === 'error').length;
    } catch { failed++; }
    const message = failed ? `${failed} integração(ões) com falha na verificação.` : 'Verificação concluída. Integrações sem configuração foram ignoradas.';
    await this.states.updateOne({ id: HEALTH_CHECK_JOB_ID, lockedBy: owner }, { $set: {
      lockedUntil: null, lockedBy: null, lastFinishedAt: new Date(), lastStatus: failed ? 'error' : 'ok', message,
    } });
    this.logger.info({ event: 'cron.finished', jobId: HEALTH_CHECK_JOB_ID, actor, failed }, message);
    return this.state();
  }
}
