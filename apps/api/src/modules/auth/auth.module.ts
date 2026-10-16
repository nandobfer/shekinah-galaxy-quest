import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { SessionGuard } from './session.guard.js';

@Module({ imports: [UsersModule], providers: [AuthService, SessionGuard], exports: [AuthService, SessionGuard] })
export class AuthModule {}
