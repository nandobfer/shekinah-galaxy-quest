import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.').max(254));
export const passwordSchema = z.string().min(12, 'Use ao menos 12 caracteres.').max(128, 'Use no máximo 128 caracteres.');
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.').max(128, 'Senha inválida.'),
});
export const createAdminSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  password: passwordSchema,
});
export const adminUserSchema = z.object({
  id: z.string(), name: z.string(), email: z.email(), role: z.literal('admin'),
});
export const sessionSchema = z.object({ user: adminUserSchema, expires: z.iso.datetime() });
export const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminSession = z.infer<typeof sessionSchema>;
