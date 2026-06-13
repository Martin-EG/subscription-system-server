import type {
  PaymentNotificationRepository,
  PendingPaymentNotification,
} from '../../../application/ports';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client';
import { PaymentNotificationStatus } from '../../../generated/prisma/client';

interface ClaimedNotification {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: Prisma.JsonValue;
  retry_count: number;
}

type Clock = () => Date;

export class PrismaPaymentNotificationRepository implements PaymentNotificationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: Clock = () => new Date(),
    private readonly lockDurationMs = 30_000,
  ) {}

  claimPending(limit: number): Promise<PendingPaymentNotification[]> {
    const now = this.clock();
    const lockedUntil = new Date(now.getTime() + this.lockDurationMs);

    return this.prisma.$transaction(async (tx) => {
      const records = await tx.$queryRaw<ClaimedNotification[]>(Prisma.sql`
        SELECT
          id,
          subscription_id,
          event_type,
          payload,
          retry_count
        FROM public.payment_notifications
        WHERE next_attempt_at <= ${now}
          AND (
            status = 'PENDING'
            OR (
              status = 'PROCESSING'
              AND locked_until <= ${now}
            )
          )
        ORDER BY next_attempt_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `);

      if (records.length === 0) {
        return [];
      }

      await tx.paymentNotification.updateMany({
        where: {
          id: { in: records.map(({ id }) => id) },
        },
        data: {
          status: PaymentNotificationStatus.PROCESSING,
          lockedUntil,
          lastAttemptAt: now,
        },
      });

      return records.map((record) => ({
        id: record.id,
        subscriptionId: record.subscription_id,
        eventType: record.event_type,
        payload: record.payload,
        retryCount: record.retry_count,
      }));
    });
  }

  async markSent(id: string): Promise<void> {
    await this.prisma.paymentNotification.updateMany({
      where: {
        id,
        status: PaymentNotificationStatus.PROCESSING,
      },
      data: {
        status: PaymentNotificationStatus.SENT,
        lockedUntil: null,
      },
    });
  }

  async scheduleRetry(id: string, nextAttemptAt: Date, maxRetries: number): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.payment_notifications
      SET
        retry_count = retry_count + 1,
        status = CASE
          WHEN retry_count + 1 >= ${maxRetries}
            THEN 'FAILED'::public."PaymentNotificationStatus"
          ELSE 'PENDING'::public."PaymentNotificationStatus"
        END,
        next_attempt_at = ${nextAttemptAt},
        locked_until = NULL
      WHERE id = ${id}::uuid
        AND status = 'PROCESSING'
    `);
  }
}
