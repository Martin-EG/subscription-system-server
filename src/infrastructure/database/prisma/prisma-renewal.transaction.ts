import type { CompleteRenewalInput, SubscriptionOutput } from '../../../application/dtos';
import type { RenewalTransactionPort } from '../../../application/ports';
import { ConflictError } from '../../../domain/errors';
import type { PrismaClient } from '../../../generated/prisma/client';
import { IdempotencyStatus, SubscriptionStatus } from '../../../generated/prisma/enums';

export class PrismaRenewalTransaction implements RenewalTransactionPort {
  constructor(private readonly prisma: PrismaClient) {}

  async completeRenewal(input: CompleteRenewalInput): Promise<SubscriptionOutput> {
    return this.prisma.$transaction(async (tx) => {
      const renewableState = input.payment
        ? {
            OR: [
              { status: SubscriptionStatus.PAST_DUE },
              { status: SubscriptionStatus.CANCELLED },
              { status: SubscriptionStatus.EXPIRED },
              {
                status: SubscriptionStatus.ACTIVE,
                expiresAt: { lte: input.payment.processedAt },
              },
            ],
          }
        : {
            status: SubscriptionStatus.ACTIVE,
            cancelAtPeriodEnd: true,
            expiresAt: { gt: input.validatedAt },
          };
      const updated = await tx.subscription.updateMany({
        where: {
          id: input.subscriptionId,
          userId: input.userId,
          ...renewableState,
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictError('Subscription can no longer be renewed');
      }

      if (input.payment) {
        await tx.paymentLog.create({
          data: {
            userId: input.userId,
            subscriptionId: input.subscriptionId,
            amount: input.payment.amount,
            currency: input.payment.currency,
            status: 'SUCCEEDED',
            paymentDate: input.payment.processedAt,
            transactionId: input.payment.transactionId,
          },
        });

        await tx.paymentNotification.create({
          data: {
            subscriptionId: input.subscriptionId,
            eventType: 'PAYMENT_SUCCEEDED',
            payload: {
              operation: 'RENEW',
              userId: input.userId,
              subscriptionId: input.subscriptionId,
              transactionId: input.payment.transactionId,
              amount: input.payment.amount,
              currency: input.payment.currency,
              occurredAt: input.payment.processedAt.toISOString(),
            },
          },
        });
      }

      await tx.userAccess.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          hasPremiumAccess: true,
          validUntil: input.expiresAt,
        },
        update: {
          hasPremiumAccess: true,
          validUntil: input.expiresAt,
        },
      });

      const response: SubscriptionOutput = {
        subscriptionId: input.subscriptionId,
        status: 'ACTIVE',
        expiresAt: input.expiresAt,
        cancelAtPeriodEnd: false,
      };

      await tx.idempotencyKey.update({
        where: {
          id: input.idempotencyId,
          userId: input.userId,
          operation: 'RENEW',
          status: 'PROCESSING',
        },
        data: {
          status: IdempotencyStatus.COMPLETED,
          resourceId: input.subscriptionId,
          responseStatus: 200,
          responseBody: {
            ...response,
            expiresAt: input.expiresAt.toISOString(),
          },
        },
      });

      return response;
    });
  }
}
