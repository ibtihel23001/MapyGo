import { z } from 'zod';

export const createTicketSchema = z.object({
  ticketNumber: z.string().min(1),
  pnr: z.string().optional(),
  passengerName: z.string().min(1),
  passengerEmail: z.string().email().optional().or(z.literal('')),
  passengerPhone: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  departureDate: z.string().optional(),
  returnDate: z.string().optional(),
  airline: z.string().optional(),
  flightNumber: z.string().optional(),
  ticketClass: z.string().optional(),
  fare: z.coerce.number().optional(),
  taxes: z.coerce.number().optional(),
  fees: z.coerce.number().optional(),
  totalAmount: z.coerce.number().optional(),
  currency: z.string().default('USD'),
  sellerName: z.string().optional(),
  clientName: z.string().optional(),
  rawEmailData: z.string().optional(),
  amadeusData: z.record(z.any()).optional(),
});

export const updateTicketSchema = createTicketSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'issued', 'cancelled', 'refunded', 'used']),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateStatusSchema>;
