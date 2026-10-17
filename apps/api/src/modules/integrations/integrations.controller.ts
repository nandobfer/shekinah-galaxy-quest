import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Inject, Injectable, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { INTEGRATIONS } from '@shekinah/contracts';
import { AccessService, type AccessRequest } from '../permissions/access.service.js';
import { hasPermission } from '@nandobfer/perfix';
import { CONFIG, type AppConfig } from '../../config.js';
import { IntegrationsService } from './integrations.service.js';
import { CronService } from './cron.service.js';

@Injectable()
export class IntegrationMutationGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD'].includes(req.method)) return true;
    if (req.headers.origin !== this.config.APP_ORIGIN || req.headers['x-shekinah-request'] !== '1') throw new ForbiddenException('Origem da operação não autorizada.');
    return true;
  }
}
type AdminRequest = AccessRequest;
@Controller('integrations')
@UseGuards(IntegrationMutationGuard)
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService, @Inject(CronService) private readonly cron: CronService, @Inject(AccessService) private readonly access: AccessService) {}
  @Get() list(@Req() req: AdminRequest) { return Promise.all(INTEGRATIONS.filter(integration => hasPermission(req.accessContext.effective, `integrations.${integration.id}.view`)).map(integration => this.integrations.detail(integration.id))); }
  @Get(':id') async detail(@Param('id') value: string, @Req() req: AdminRequest) {
    const id = this.integrations.id(value);
    await this.access.require(req.accessContext, `integrations.${id}.view`);
    return { ...await this.integrations.detail(id), ...(id === 'crons' ? { cronState: await this.cron.state() } : {}) };
  }
  @Patch(':id') async save(@Param('id') value: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const id = this.integrations.id(value);
    await this.access.require(req.accessContext, `integrations.${id}.edit`);
    const result = await this.integrations.save(id, body, req.adminSession.user.id, req.accessContext.dto.simulation);
    if (id === 'crons') await this.cron.sync();
    return result;
  }
  @Post(':id/test') async test(@Param('id') value: string, @Req() req: AdminRequest) {
    const id = this.integrations.id(value);
    await this.access.require(req.accessContext, `integrations.${id}.explore`);
    if (id === 'ai') await this.access.require(req.accessContext, ...['ai_opencode', 'ai_gemini', 'ai_jev'].map(provider => `integrations.${provider}.explore`));
    return this.integrations.check(id, 'manual', req.adminSession.user.id, req.accessContext.dto.simulation);
  }
  @Get(':id/logs') async logs(@Param('id') value: string, @Req() req: AdminRequest) {
    const id = this.integrations.id(value); await this.access.require(req.accessContext, `integrations.${id}.explore`); return this.integrations.logs(id);
  }
  @Post('crons/jobs/:jobId/run') async run(@Param('jobId') jobId: string, @Req() req: AdminRequest) {
    await this.access.require(req.accessContext, 'integrations.crons.run');
    if (jobId !== 'integrations-health-check') throw new BadRequestException('Rotina não registrada.');
    return this.cron.run(true, req.adminSession.user.id, new Date(), req.accessContext.dto.simulation);
  }
}
