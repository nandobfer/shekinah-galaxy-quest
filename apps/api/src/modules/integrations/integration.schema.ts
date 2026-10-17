import { Schema } from 'mongoose';
import type { Access, IntegrationHealth, IntegrationId, IntegrationLog, PublicValue } from '@shekinah/contracts';
import type { SealedSecret } from './secret-box.js';

export interface IntegrationRecord {
  id: IntegrationId; environment: 'interno' | 'externo'; debugMode: boolean; version: number;
  publicValues: Record<string, PublicValue>; secrets: Record<string, SealedSecret>;
  health: IntegrationHealth | null; updatedAt: Date;
  audit: { at: Date; actor: string; action: string; fields: string[]; simulation?: Access['simulation'] }[];
}
export const IntegrationRecordSchema = new Schema<IntegrationRecord>({
  id: { type: String, required: true, unique: true }, environment: { type: String, required: true },
  debugMode: { type: Boolean, default: false }, version: { type: Number, default: 0 },
  publicValues: { type: Schema.Types.Mixed, default: {} }, secrets: { type: Schema.Types.Mixed, default: {}, select: false },
  health: { type: Schema.Types.Mixed, default: null }, audit: { type: [{ at: Date, actor: String, action: String, fields: [String], simulation: Schema.Types.Mixed }], default: [], select: false },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'integrations', minimize: false });
export interface DebugRecord extends Omit<IntegrationLog, 'at'> { integrationId: IntegrationId; at: Date; }
export const DebugRecordSchema = new Schema<DebugRecord>({
  integrationId: { type: String, required: true, index: true }, at: { type: Date, required: true },
  level: { type: String, required: true }, message: { type: String, required: true }, source: { type: String, required: true },
}, { collection: 'integration_debug_logs' });
DebugRecordSchema.index({ at: 1 }, { expireAfterSeconds: 172800 });
export interface CronRecord {
  scheduleVersion: number;
  id: string; lockedUntil: Date | null; lockedBy: string | null; nextRunAt: Date | null;
  lastRunAt: Date | null; lastFinishedAt: Date | null; lastStatus: 'ok' | 'error' | null; message: string | null;
}
export const CronRecordSchema = new Schema<CronRecord>({
  scheduleVersion: { type: Number, default: -1 },
  id: { type: String, required: true, unique: true }, lockedUntil: { type: Date, default: null }, lockedBy: { type: String, default: null },
  nextRunAt: { type: Date, default: null }, lastRunAt: { type: Date, default: null }, lastFinishedAt: { type: Date, default: null },
  lastStatus: { type: String, default: null }, message: { type: String, default: null },
}, { collection: 'cron_states' });
