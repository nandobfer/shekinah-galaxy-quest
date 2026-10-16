import { z } from 'zod';

const schema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  AUTH_SECRET: z.string().min(32),
  APP_ORIGIN: z.url().refine(value => new URL(value).origin === value, 'APP_ORIGIN deve conter apenas a origem, sem caminho ou barra final.'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(604800).default(28800),
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
  LOGIN_RATE_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
}).superRefine((config, ctx) => {
  if (config.NODE_ENV === 'production' && !config.APP_ORIGIN.startsWith('https://')) ctx.addIssue({ code: 'custom', message: 'Produção exige APP_ORIGIN HTTPS.' });
});
export type AppConfig = z.infer<typeof schema>;
export const CONFIG = Symbol('CONFIG');
export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success) throw new Error(`Configuração inválida: ${result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  return result.data;
}
