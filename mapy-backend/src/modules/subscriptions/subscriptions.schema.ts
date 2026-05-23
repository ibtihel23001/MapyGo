import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  agencyId: z.number().int().positive(),
  planName: z.string().default('Annual Plan'),
  price: z.coerce.number().min(0),
  currency: z.string().default('USD'),
  startDate: z.string(),
  endDate: z.string(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.enum(['active', 'expired', 'cancelled', 'pending']),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
