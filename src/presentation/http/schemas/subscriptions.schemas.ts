import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const checkoutSubscriptionSchema = z.object({
  planId: z.uuid(),
  paymentMethod: z.string().trim().min(1).max(100),
});

export const idempotencyKeySchema = z.string().trim().min(1).max(255);

export const renewSubscriptionBodySchema = z
  .object({
    paymentMethod: z.string().trim().min(1).max(255),
    idempotencyKey: z.string().trim().min(8).max(255),
  })
  .strict();
