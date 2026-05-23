import { z } from 'zod';

export const createRegistrationSchema = z.object({
  agencyName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  licenseNumber: z.string().optional(),
  message: z.string().optional(),
});

export const reviewRegistrationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(8).optional(),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional(),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type ReviewRegistrationInput = z.infer<typeof reviewRegistrationSchema>;
