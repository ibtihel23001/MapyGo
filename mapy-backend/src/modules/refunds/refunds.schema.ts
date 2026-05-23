import { z } from 'zod';

export const createRefundSchema = z.object({
  ticketId: z.number().int().positive().optional(),
  ticketNumber: z.string().optional(),
  passengerName: z.string().min(1),
  reason: z.string().min(5),
  refundAmount: z.coerce.number().positive(),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
});

export const updateRefundStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'processed']),
  notes: z.string().optional(),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type UpdateRefundStatusInput = z.infer<typeof updateRefundStatusSchema>;
