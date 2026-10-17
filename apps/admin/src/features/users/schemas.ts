import { userAccessUpdateSchema } from '@shekinah/contracts';
import { z } from 'zod';
export const userInputSchema = userAccessUpdateSchema.extend({ email: z.email() });
export type UserInput = z.infer<typeof userInputSchema>;
