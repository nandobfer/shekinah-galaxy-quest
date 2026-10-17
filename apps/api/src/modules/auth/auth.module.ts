import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';
import { AccessModule } from '../permissions/access.module.js';

@Module({ imports: [UsersModule, AccessModule], providers: [AuthService, SessionGuard], exports: [AuthService, SessionGuard, AccessModule] })
export class AuthModule {}
