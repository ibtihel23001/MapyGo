// ─── agencies.schema.ts ──────────────────────────────────────
import { z } from 'zod';

export const createAgencySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  licenseNumber: z.string().optional(),
});

export const updateAgencySchema = createAgencySchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'inactive']),
});

export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
export type UpdateAgencyInput = z.infer<typeof updateAgencySchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
