import { z } from 'zod';

export const createReportSchema = z.object({
  type: z.enum(['tickets', 'financial', 'refunds', 'summary']),
  title: z.string().min(1),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
