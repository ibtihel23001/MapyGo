import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().default('http://localhost:3001'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MAIL_HOST: z.string().default('smtp.gmail.com'),
  MAIL_PORT: z.coerce.number().default(587),
  MAIL_USER: z.string().default(''),
  MAIL_PASS: z.string().default(''),
  MAIL_FROM_NAME: z.string().default('MAP eTicket Platform'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
