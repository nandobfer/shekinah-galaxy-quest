import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../users/user.schema.js';
import { AccessRoleSchema, AccessStateSchema, AccessAuditSchema } from './access.schema.js';
import { AccessService } from './access.service.js';
import { AccessCommands } from './access.commands.js';
import { AccessController } from './access.controller.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }, { name: 'AccessRole', schema: AccessRoleSchema }, { name: 'AccessState', schema: AccessStateSchema }, { name: 'AccessAudit', schema: AccessAuditSchema }])],
  providers: [AccessService, AccessCommands], controllers: [AccessController], exports: [AccessService],
})
export class AccessModule {}
