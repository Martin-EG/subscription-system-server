import type { SubscriptionRepository } from '../../../src/application/ports';
import { RenewSubscriptionUseCase } from '../../../src/application/use-cases';
import { ConflictError } from '../../../src/domain/errors';

function createRepository(overrides: Partial<SubscriptionRepository> = {}) {
  return {
    findCurrentByUserId: jest.fn(),
    findRenewableByUserId: jest.fn(),
    findAll: jest.fn(),
    scheduleCancellation: jest.fn(),
    renew: jest.fn(),
    save: jest.fn(),
    ...overrides,
  } as jest.Mocked<SubscriptionRepository>;
}

const subscription = {
  subscriptionId: 'subscription-id',
  userId: 'user-id',
  planId: 'monthly-plan-id',
  status: 'CANCELLED' as const,
  startedAt: new Date('2026-05-31T10:30:00.000Z'),
  expiresAt: new Date('2026-06-30T10:30:00.000Z'),
  cancelAtPeriodEnd: false,
  billingPeriod: 'MONTHLY' as const,
  price: 99,
  currency: 'MXN',
};

describe('RenewSubscriptionUseCase', () => {
  const input = {
    userId: 'user-id',
    paymentMethod: 'pm_test',
    idempotencyKey: 'renew-request-1',
  };

  it('starts a new monthly period and reuses the existing plan', async () => {
    const now = new Date('2026-01-31T10:30:00.000Z');
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue(subscription),
      renew: jest.fn().mockResolvedValue({
        subscriptionId: 'subscription-id',
        status: 'ACTIVE',
        expiresAt: new Date('2026-02-28T10:30:00.000Z'),
        cancelAtPeriodEnd: false,
      }),
    });

    const result = await new RenewSubscriptionUseCase(repository, () => now).execute(input);

    expect(result.expiresAt).toEqual(new Date('2026-02-28T10:30:00.000Z'));
    expect(repository.renew.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        subscriptionId: 'subscription-id',
        userId: 'user-id',
        startedAt: now,
        expiresAt: new Date('2026-02-28T10:30:00.000Z'),
        idempotencyKey: 'renew-request-1',
      }),
    );
  });

  it('undoes a scheduled cancellation without extending the current period', async () => {
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue({
        ...subscription,
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      }),
      renew: jest.fn().mockResolvedValue({
        subscriptionId: 'subscription-id',
        status: 'ACTIVE',
        expiresAt: subscription.expiresAt,
        cancelAtPeriodEnd: false,
      }),
    });

    await new RenewSubscriptionUseCase(repository).execute(input);

    expect(repository.renew.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
      }),
    );
  });

  it('allows a past-due subscription', async () => {
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue({ ...subscription, status: 'PAST_DUE' }),
      renew: jest.fn().mockResolvedValue({
        subscriptionId: 'subscription-id',
        status: 'ACTIVE',
        expiresAt: new Date(),
        cancelAtPeriodEnd: false,
      }),
    });

    await expect(new RenewSubscriptionUseCase(repository).execute(input)).resolves.toBeDefined();
  });

  it('rejects an active subscription without scheduled cancellation', async () => {
    const repository = createRepository({
      findRenewableByUserId: jest.fn().mockResolvedValue({
        ...subscription,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      }),
      renew: jest
        .fn()
        .mockRejectedValue(new ConflictError('Subscription can no longer be renewed')),
    });

    await expect(new RenewSubscriptionUseCase(repository).execute(input)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
