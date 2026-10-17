import type { z } from 'zod';
import type { effectiveRoleSchema } from '@shekinah/contracts';
export type ViewAsRoleOption = z.infer<typeof effectiveRoleSchema> & { coringa: boolean };
export interface ViewAsUserOption { id: string; nome: string; email: string; cargos: z.infer<typeof effectiveRoleSchema>[]; }
