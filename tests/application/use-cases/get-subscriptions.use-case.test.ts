import type { AuthenticatedUser, SubscriptionDetailsOutput } from '../../../src/application/dtos';
import type { SubscriptionRepository } from '../../../src/application/ports';
import { GetSubscriptionsUseCase } from '../../../src/application/use-cases';
import { NotFoundError } from '../../../src/domain/errors';

describe('GetSubscriptionsUseCase', () => {
  const subscription: SubscriptionDetailsOutput = {
    subscriptionId: 'subscription-id',
    userId: 'user-id',
    userName: 'Jane Doe',
    userEmail: 'jane@example.com',
    status: 'ACTIVE',
    plan: {
      id: 'plan-id',
      name: 'Premium mensual',
      price: 99,
      currency: 'MXN',
      billingPeriod: 'MONTHLY',
    },
    startedAt: new Date('2026-06-12T00:00:00.000Z'),
    expiresAt: new Date('2026-07-12T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
  };

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

  it('returns only the authenticated regular user current subscription', async () => {
    const findCurrentByUserId = jest.fn().mockResolvedValue(subscription);
    const findAll = jest.fn();
    const repository = createRepository({
      findCurrentByUserId,
      findAll,
    });
    const useCase = new GetSubscriptionsUseCase(repository);
    const currentUser: AuthenticatedUser = {
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    };

    await expect(useCase.execute({ currentUser, page: 1, limit: 20 })).resolves.toEqual(
      subscription,
    );
    expect(findCurrentByUserId).toHaveBeenCalledWith('user-id');
    expect(findAll).not.toHaveBeenCalled();
  });

  it('returns paginated subscriptions for an admin', async () => {
    const findCurrentByUserId = jest.fn();
    const findAll = jest.fn().mockResolvedValue({
      items: [subscription],
      total: 1,
    });
    const repository = createRepository({
      findCurrentByUserId,
      findAll,
    });
    const useCase = new GetSubscriptionsUseCase(repository);
    const currentUser: AuthenticatedUser = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'John Doe',
      role: 'ADMIN',
    };

    await expect(useCase.execute({ currentUser, page: 2, limit: 10 })).resolves.toEqual({
      data: [subscription],
      total: 1,
      page: 2,
      limit: 10,
    });
    expect(findAll).toHaveBeenCalledWith({ page: 2, limit: 10 });
    expect(findCurrentByUserId).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when a regular user has no current subscription', async () => {
    const repository = createRepository({
      findCurrentByUserId: jest.fn().mockResolvedValue(null),
    });
    const useCase = new GetSubscriptionsUseCase(repository);
    const currentUser: AuthenticatedUser = {
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    };

    await expect(useCase.execute({ currentUser, page: 1, limit: 20 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('does not grant admin access to an unknown or missing role', async () => {
    const findCurrentByUserId = jest.fn().mockResolvedValue(subscription);
    const findAll = jest.fn();
    const repository = createRepository({
      findCurrentByUserId,
      findAll,
    });
    const useCase = new GetSubscriptionsUseCase(repository);
    const currentUser: AuthenticatedUser = {
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: null,
    };

    await useCase.execute({ currentUser, page: 1, limit: 20 });

    expect(findCurrentByUserId).toHaveBeenCalledWith('user-id');
    expect(findAll).not.toHaveBeenCalled();
  });
});
