import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(1000).default(100),
  OUTBOX_MAX_RETRIES: z.coerce.number().int().positive().default(5),
  PAYMENT_NOTIFICATION_TOPIC: z.string().min(1).default('payment-succeeded'),
  SUBSCRIPTION_EXPIRATION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  SUBSCRIPTION_EXPIRATION_BATCH_SIZE: z.coerce.number().int().positive().max(1000).default(100),
});

export const env = envSchema.parse(process.env);
