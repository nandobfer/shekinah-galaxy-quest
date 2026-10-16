import { Controller, Get, Global, Module, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import type { Request } from 'express';
import type { AdminSession } from '@shekinah/contracts';
import { CONFIG, type AppConfig } from './config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { Public, SessionGuard } from './modules/auth/session.guard.js';
import { openapi } from './openapi.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';

@Controller()
class AppController {
  @Get('health') @Public() health() { return { status: 'ok' }; }
  @Get('openapi.json') openapi() { return openapi; }
  @Get('me')
  me(@Req() req: Request & { adminSession: AdminSession }) { return req.adminSession; }
}

@Module({})
export class AppModule {
  static register(config: AppConfig) {
    @Global()
    @Module({ providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] })
    class ConfigModule {}
    return {
      module: AppModule,
      imports: [ConfigModule, MongooseModule.forRoot(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000, retryAttempts: 0 }), AuthModule, IntegrationsModule],
      controllers: [AppController],
      providers: [{ provide: APP_GUARD, useExisting: SessionGuard }],
    };
  }
}
