import { z } from 'zod';

export const upsertApiConfigSchema = z.object({
  emailAddress: z.string().email(),
  emailPassword: z.string().min(1),
  imapHost: z.string().default('imap.gmail.com'),
  imapPort: z.coerce.number().default(993),
  isActive: z.boolean().default(true),
});

export type UpsertApiConfigInput = z.infer<typeof upsertApiConfigSchema>;
