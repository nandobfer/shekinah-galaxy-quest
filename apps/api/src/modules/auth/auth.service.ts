import { Inject, Injectable } from '@nestjs/common';
import { Auth, type AuthConfig } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';
import { loginSchema, sessionSchema, type AdminSession } from '@shekinah/contracts';
import { CONFIG, type AppConfig } from '../../config.js';
import { createLogger } from '../../logger.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  readonly options: AuthConfig;
  constructor(@Inject(UsersService) users: UsersService, @Inject(CONFIG) config: AppConfig) {
    const logger = createLogger(config.LOG_LEVEL);
    this.options = {
      secret: config.AUTH_SECRET, trustHost: true, basePath: '/api/v1/auth',
      useSecureCookies: config.NODE_ENV === 'production',
      session: { strategy: 'jwt', maxAge: config.SESSION_MAX_AGE_SECONDS },
      pages: { signIn: '/login', error: '/login' },
      providers: [Credentials({
        credentials: { email: {}, password: {} },
        authorize: async credentials => {
          const result = loginSchema.safeParse(credentials);
          if (!result.success) return null;
          const user = await users.authenticate(result.data.email, result.data.password);
          return user ? { ...users.toPublic(user), sessionVersion: user.sessionVersion } : null;
        },
      })],
      callbacks: {
        jwt: async ({ token, user }) => {
          if (user) { token.sub = user.id; token.sessionVersion = 'sessionVersion' in user ? user.sessionVersion : undefined; }
          if (!token.sub || typeof token.sessionVersion !== 'number') return null;
          const current = await users.findActive(token.sub, token.sessionVersion);
          if (!current) return null;
          token.name = current.name; token.email = current.email;
          return token;
        },
        session: async ({ session, token }) => {
          Object.assign(session.user, { id: token.sub!, name: token.name!, email: token.email!, role: 'admin' });
          return session;
        },
      },
      events: {
        signIn: async ({ user }) => { logger.info({ action: 'auth.login', actorId: user.id }, 'Administrador autenticado'); },
        signOut: async message => {
          if ('token' in message && message.token?.sub) {
            await users.revokeSessions(message.token.sub);
            logger.info({ action: 'auth.logout', actorId: message.token.sub }, 'Sessões revogadas');
          }
        },
      },
      logger: {
        error: error => logger.warn({ action: 'auth.error', code: 'type' in error ? error.type : error.name }, 'Falha de autenticação'),
        warn: code => logger.warn({ action: 'auth.warning', code }, 'Aviso de autenticação'),
        debug: () => undefined,
      },
    };
  }

  handle(request: Request) { return Auth(request, this.options); }

  async session(origin: string, cookie = ''): Promise<{ session: AdminSession | null; cookies: string[] }> {
    const response = await this.handle(new Request(`${origin}/api/v1/auth/session`, { headers: { cookie } }));
    const data: unknown = await response.json();
    const result = sessionSchema.safeParse(data);
    return { session: result.success ? result.data : null, cookies: response.headers.getSetCookie() };
  }
}
