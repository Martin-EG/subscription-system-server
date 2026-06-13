import type {
  ExpireDueSubscriptionsInput,
  ExpireDueSubscriptionsResult,
  SubscriptionExpirationPort,
} from '../../../application/ports';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client';

interface ExpiredSubscription {
  id: string;
  user_id: string;
}

export class PrismaSubscriptionExpirationRepository implements SubscriptionExpirationPort {
  constructor(private readonly prisma: PrismaClient) {}

  expireDue({ now, limit }: ExpireDueSubscriptionsInput): Promise<ExpireDueSubscriptionsResult> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<ExpiredSubscription[]>(Prisma.sql`
        WITH due_subscriptions AS (
          SELECT
            id,
            cancel_at_period_end
          FROM public.subscriptions
          WHERE status IN ('ACTIVE', 'PAST_DUE')
            AND expires_at IS NOT NULL
            AND expires_at <= ${now}
          ORDER BY expires_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE public.subscriptions AS subscriptions
        SET
          status = CASE
            WHEN due_subscriptions.cancel_at_period_end
              THEN 'CANCELLED'::public."SubscriptionStatus"
            ELSE 'EXPIRED'::public."SubscriptionStatus"
          END,
          cancelled_at = CASE
            WHEN due_subscriptions.cancel_at_period_end
              THEN COALESCE(subscriptions.cancelled_at, ${now})
            ELSE subscriptions.cancelled_at
          END,
          updated_at = ${now}
        FROM due_subscriptions
        WHERE subscriptions.id = due_subscriptions.id
        RETURNING subscriptions.id, subscriptions.user_id
      `);

      if (expired.length === 0) {
        return {
          expiredSubscriptions: 0,
          revokedAccess: 0,
        };
      }

      const revoked = await tx.userAccess.updateMany({
        where: {
          userId: {
            in: expired.map(({ user_id }) => user_id),
          },
          hasPremiumAccess: true,
          validUntil: {
            not: null,
            lte: now,
          },
        },
        data: {
          hasPremiumAccess: false,
          validUntil: null,
          updatedAt: now,
        },
      });

      return {
        expiredSubscriptions: expired.length,
        revokedAccess: revoked.count,
      };
    });
  }
}
