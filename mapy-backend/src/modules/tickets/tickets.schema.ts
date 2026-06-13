import { z } from 'zod';

export const createTicketSchema = z.object({
  ticketNumber: z.string().min(1),
  pnr:          z.string().optional(),
  passengerName: z.string().min(1),
  dateOfIssue:   z.string().optional(),
  departureDate: z.string().optional(),
  arrivalDate:   z.string().optional(),
  airFare:       z.coerce.number().optional(),
  ttc:           z.coerce.number().optional(),
});

export const updateTicketSchema = createTicketSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'refund']),
});

export type CreateTicketInput      = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput      = z.infer<typeof updateTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateStatusSchema>;
