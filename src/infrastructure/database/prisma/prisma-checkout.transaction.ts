import type { CompleteCheckoutInput, CompleteCheckoutResult } from '../../../application/dtos';
import type { CheckoutTransactionPort } from '../../../application/ports';
import type { PrismaClient } from '../../../generated/prisma/client';
import {
  IdempotencyStatus,
  PaymentNotificationStatus,
  SubscriptionStatus,
} from '../../../generated/prisma/enums';

export class PrismaCheckoutTransaction implements CheckoutTransactionPort {
  constructor(private readonly prisma: PrismaClient) {}

  async completeCheckout(input: CompleteCheckoutInput): Promise<CompleteCheckoutResult> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.upsert({
        where: {
          userId: input.userId,
        },
        create: {
          userId: input.userId,
          planId: input.planId,
          status: SubscriptionStatus.ACTIVE,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        },
        update: {
          planId: input.planId,
          status: SubscriptionStatus.ACTIVE,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null,
        },
      });

      await tx.paymentLog.create({
        data: {
          userId: input.userId,
          subscriptionId: subscription.id,
          amount: input.amount,
          currency: input.currency,
          status: 'SUCCEEDED',
          paymentDate: input.startedAt,
          transactionId: input.transactionId,
        },
      });

      await tx.paymentNotification.create({
        data: {
          subscriptionId: subscription.id,
          status: PaymentNotificationStatus.PENDING,
        },
      });

      await tx.userAccess.upsert({
        where: {
          userId: input.userId,
        },
        update: {
          hasPremiumAccess: true,
          validUntil: input.expiresAt,
          updatedAt: new Date(),
        },
        create: {
          userId: input.userId,
          hasPremiumAccess: true,
          validUntil: input.expiresAt,
          updatedAt: new Date(),
        },
      });

      const result: CompleteCheckoutResult = {
        subscriptionId: subscription.id,
        status: 'ACTIVE',
        expiresAt: subscription.expiresAt,
      };

      await tx.idempotencyKey.update({
        where: {
          id: input.idempotencyId,
          userId: input.userId,
          operation: 'CHECKOUT',
          status: 'PROCESSING',
        },
        data: {
          status: IdempotencyStatus.COMPLETED,
          resourceId: subscription.id,
          responseStatus: 201,
          responseBody: {
            subscriptionId: result.subscriptionId,
            status: result.status,
            expiresAt: result.expiresAt?.toISOString() ?? null,
          },
        },
      });

      return result;
    });
  }
}
