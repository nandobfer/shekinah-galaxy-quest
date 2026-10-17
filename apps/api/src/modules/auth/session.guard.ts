import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { CONFIG, type AppConfig } from '../../config.js';
import { AuthService } from './auth.service.js';
import { AccessService } from '../permissions/access.service.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(CONFIG) private readonly config: AppConfig, @Inject(Reflector) private readonly reflector: Reflector, @Inject(AccessService) private readonly access: AccessService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    res.setHeader('cache-control', 'no-store');
    const { session, cookies } = await this.auth.session(this.config.APP_ORIGIN, req.headers.cookie);
    if (cookies.length) res.setHeader('set-cookie', cookies);
    if (!session) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Entre para continuar.' } });
    const accessContext = await this.access.resolve(session.user.id, req.get('x-perfix-view-as'));
    Object.assign(req, { adminSession: { ...session, access: accessContext.dto }, accessContext });
    return true;
  }
}
export const Public = () => SetMetadata('public', true);
