import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Inject, Injectable, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminSession } from '@shekinah/contracts';
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
type AdminRequest = Request & { adminSession: AdminSession };
@Controller('integrations')
@UseGuards(IntegrationMutationGuard)
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private readonly integrations: IntegrationsService, @Inject(CronService) private readonly cron: CronService) {}
  @Get() list() { return this.integrations.list(); }
  @Get(':id') async detail(@Param('id') value: string) {
    const id = this.integrations.id(value);
    return { ...await this.integrations.detail(id), ...(id === 'crons' ? { cronState: await this.cron.state() } : {}) };
  }
  @Patch(':id') async save(@Param('id') value: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const id = this.integrations.id(value);
    const result = await this.integrations.save(id, body, req.adminSession.user.id);
    if (id === 'crons') await this.cron.sync();
    return result;
  }
  @Post(':id/test') async test(@Param('id') value: string, @Req() req: AdminRequest) {
    return this.integrations.check(this.integrations.id(value), 'manual', req.adminSession.user.id);
  }
  @Get(':id/logs') logs(@Param('id') value: string) { return this.integrations.logs(this.integrations.id(value)); }
  @Post('crons/jobs/:jobId/run') run(@Param('jobId') jobId: string, @Req() req: AdminRequest) {
    if (jobId !== 'integrations-health-check') throw new BadRequestException('Rotina não registrada.');
    return this.cron.run(true, req.adminSession.user.id);
  }
}
