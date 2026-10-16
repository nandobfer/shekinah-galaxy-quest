import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationRecordSchema, DebugRecordSchema, CronRecordSchema } from './integration.schema.js';
import { IntegrationsController, IntegrationMutationGuard } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { ConnectionChecker } from './connection-checker.js';
import { CronService } from './cron.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'IntegrationRecord', schema: IntegrationRecordSchema }, { name: 'IntegrationDebug', schema: DebugRecordSchema }, { name: 'CronRecord', schema: CronRecordSchema }])],
  providers: [IntegrationsService, ConnectionChecker, CronService, IntegrationMutationGuard], controllers: [IntegrationsController],
})
export class IntegrationsModule {}
