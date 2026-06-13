import type { SubscriptionDetailsOutput } from '../../../application/dtos';
import type {
  FindSubscriptionQuery,
  RenewSubscriptionPersistenceInput,
  ScheduleCancellationInput,
  SubscriptionRepository,
  SubscriptionSearchResult,
} from '../../../application/ports';
import type { Subscription } from '../../../domain/entities';
import { ConflictError, NotImplementedError, NotFoundError } from '../../../domain/errors';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import {
  IdempotencyOperation,
  IdempotencyStatus,
  SubscriptionStatus,
} from '../../../generated/prisma/enums';

type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: {
    user: true;
    plan: true;
  };
}>;

type MapSubscriptionData = (subscription: SubscriptionWithRelations) => SubscriptionDetailsOutput;
const mapSubscriptionData: MapSubscriptionData = (subscription) => ({
  subscriptionId: subscription.id,
  userId: subscription.userId,
  userEmail: subscription.user.email,
  userName: subscription.user.name,
  status: subscription.status,
  plan: {
    id: subscription.planId,
    name: subscription.plan.name,
    price: subscription.plan.price.toNumber(),
    currency: subscription.plan.currency,
    billingPeriod: subscription.plan.billingPeriod,
  },
  startedAt: subscription.startedAt,
  expiresAt: subscription.expiresAt,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
});

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentByUserId(userId: string): Promise<SubscriptionDetailsOutput | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      },
      include: {
        user: true,
        plan: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!subscription) {
      return null;
    }

    return mapSubscriptionData(subscription);
  }

  async findRenewableByUserId(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.CANCELLED,
          ],
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!subscription) {
      return null;
    }

    return {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      status: subscription.status,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      billingPeriod: subscription.plan.billingPeriod,
      price: subscription.plan.price.toNumber(),
      currency: subscription.plan.currency,
    };
  }

  async findAll({ page, limit }: FindSubscriptionQuery): Promise<SubscriptionSearchResult> {
    const where = {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        include: {
          user: true,
          plan: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      items: items.map((item) => mapSubscriptionData(item)),
      total,
    };
  }

  async scheduleCancellation(input: ScheduleCancellationInput) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.subscription.updateMany({
        where: {
          id: input.subscriptionId,
          userId: input.userId,
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
        },
        data: {
          cancelledAt: input.cancelledAt,
          cancelAtPeriodEnd: true,
        },
      });

      const subscription = await transaction.subscription.findUnique({
        where: { id: input.subscriptionId },
      });

      if (!subscription || subscription.userId !== input.userId) {
        throw new NotFoundError('Subscription');
      }

      if (result.count === 0 && !subscription.cancelAtPeriodEnd) {
        throw new ConflictError('Subscription can no longer be cancelled');
      }

      if (subscription.expiresAt) {
        await transaction.userAccess.upsert({
          where: { userId: input.userId },
          create: {
            userId: input.userId,
            hasPremiumAccess: true,
            validUntil: subscription.expiresAt,
          },
          update: {
            hasPremiumAccess: true,
            validUntil: subscription.expiresAt,
          },
        });
      }

      return {
        subscriptionId: subscription.id,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      };
    });
  }

  async renew(input: RenewSubscriptionPersistenceInput) {
    return this.prisma.$transaction(async (transaction) => {
      const uniqueKey = {
        userId: input.userId,
        operation: IdempotencyOperation.RENEW,
        key: input.idempotencyKey,
      };
      const existingKey = await transaction.idempotencyKey.findUnique({
        where: {
          userId_operation_key: uniqueKey,
        },
      });

      if (existingKey) {
        if (existingKey.requestHash !== input.requestHash) {
          throw new ConflictError('Idempotency key was already used for another request');
        }

        if (
          existingKey.status === IdempotencyStatus.COMPLETED &&
          existingKey.responseBody &&
          typeof existingKey.responseBody === 'object'
        ) {
          const response = existingKey.responseBody as {
            subscriptionId: string;
            status: SubscriptionStatus;
            expiresAt: string;
            cancelAtPeriodEnd: boolean;
          };

          return {
            ...response,
            expiresAt: new Date(response.expiresAt),
          };
        }

        throw new ConflictError('Renewal with this idempotency key is already processing');
      }

      const idempotencyKey = await transaction.idempotencyKey.create({
        data: {
          ...uniqueKey,
          requestHash: input.requestHash,
          expiresAt: input.idempotencyExpiresAt,
        },
      });
      const result = await transaction.subscription.updateMany({
        where: {
          id: input.subscriptionId,
          userId: input.userId,
          OR: [
            { status: SubscriptionStatus.PAST_DUE },
            { status: SubscriptionStatus.CANCELLED },
            {
              status: SubscriptionStatus.ACTIVE,
              cancelAtPeriodEnd: true,
            },
          ],
        },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startedAt: input.startedAt,
          expiresAt: input.expiresAt,
          cancelledAt: null,
          cancelAtPeriodEnd: false,
        },
      });

      if (result.count === 0) {
        throw new ConflictError('Subscription can no longer be renewed');
      }

      await transaction.userAccess.upsert({
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

      const response = {
        subscriptionId: input.subscriptionId,
        status: SubscriptionStatus.ACTIVE,
        expiresAt: input.expiresAt,
        cancelAtPeriodEnd: false,
      };
      await transaction.idempotencyKey.update({
        where: { id: idempotencyKey.id },
        data: {
          status: IdempotencyStatus.COMPLETED,
          responseStatus: 200,
          responseBody: {
            ...response,
            expiresAt: response.expiresAt.toISOString(),
          },
          resourceId: input.subscriptionId,
        },
      });

      return response;
    });
  }

  save(_subscription: Subscription): Promise<void> {
    return Promise.reject(new NotImplementedError('Prisma subscription repository'));
  }
}
