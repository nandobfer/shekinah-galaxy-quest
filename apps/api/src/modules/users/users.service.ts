import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isObjectIdOrHexString } from 'mongoose';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { createAdminSchema, type AdminUser, type CreateAdminInput } from '@shekinah/contracts';
import type { User, UserDocument } from './user.schema.js';
import { ensureAdministrator } from '../permissions/access.schema.js';

export class DuplicateAdminError extends Error {
  constructor() { super('Já existe um usuário com esse e-mail. Nenhuma conta foi alterada.'); }
}
export const passwordOptions = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

@Injectable()
export class UsersService {
  private dummyHash = hash('not-a-real-account-password', passwordOptions);
  constructor(@InjectModel('User') private readonly users: Model<User>) {}

  async createAdmin(input: CreateAdminInput): Promise<AdminUser> {
    const data = createAdminSchema.parse(input);
    // Ensure the unique index exists before either API or CLI can insert users.
    await this.users.init();
    const administrator = await ensureAdministrator(this.users.db);
    try {
      const user = await this.users.create({ name: data.name, email: data.email, passwordHash: await hash(data.password, passwordOptions), role: 'admin', roles: [administrator.id] });
      return this.toPublic(user);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) throw new DuplicateAdminError();
      throw error;
    }
  }

  async authenticate(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.users.findOne({ email }).select('+passwordHash');
    const valid = await verify(user?.passwordHash ?? await this.dummyHash, password);
    return valid && user?.active ? user : null;
  }

  async findActive(id: string, version: number): Promise<UserDocument | null> {
    if (!isObjectIdOrHexString(id)) return null;
    return this.users.findOne({ _id: id, active: true, sessionVersion: version });
  }

  async revokeSessions(id: string) {
    if (isObjectIdOrHexString(id)) await this.users.updateOne({ _id: id }, { $inc: { sessionVersion: 1 } });
  }

  toPublic(user: UserDocument): AdminUser {
    return { id: user.id as string, name: user.name, email: user.email, role: user.role };
  }
}
