import { z } from 'zod';

export const createTransactionSchema = z.object({
  type: z.enum(['revenue', 'expense', 'refund', 'commission']),
  category: z.string().optional(),
  description: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().default('USD'),
  reference: z.string().optional(),
  ticketId: z.number().int().positive().optional(),
  refundId: z.number().int().positive().optional(),
  transactionDate: z.string(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
