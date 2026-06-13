import type { AuthenticatedUser, PaginatedPaymentsOutput } from '../../../src/application/dtos';
import type { PaymentRepository } from '../../../src/application/ports';
import { GetPaymentLogsUseCase } from '../../../src/application/use-cases';
import { ForbiddenError } from '../../../src/domain/errors';

describe('GetPaymentLogsUseCase', () => {
  function createRepository(overrides: Partial<PaymentRepository> = {}) {
    return {
      findByUserId: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      ...overrides,
    } as jest.Mocked<PaymentRepository>;
  }

  it('returns paginated payment logs for admin users', async () => {
    const payments = [
      {
        id: 'payment-log-id',
        userId: 'user-id',
        subscriptionId: 'subscription-id',
        amount: 99,
        currency: 'MXN',
        status: 'SUCCEEDED',
        paymentDate: new Date('2026-06-13T12:00:00.000Z'),
        transactionId: 'transaction-id',
      },
    ];

    const repository = createRepository({
      findAll: jest.fn().mockResolvedValue({
        items: payments,
        total: 1,
      }),
    });

    const useCase = new GetPaymentLogsUseCase(repository);
    const currentUser: AuthenticatedUser = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    };

    await expect(useCase.execute({ currentUser, page: 1, limit: 10 })).resolves.toEqual({
      data: payments,
      total: 1,
      page: 1,
      limit: 10,
    });

    expect(repository.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('throws ForbiddenError for non-admin users', async () => {
    const repository = createRepository({
      findAll: jest.fn(),
    });

    const useCase = new GetPaymentLogsUseCase(repository);
    const currentUser: AuthenticatedUser = {
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    };

    await expect(useCase.execute({ currentUser, page: 1, limit: 10 })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(repository.findAll).not.toHaveBeenCalled();
  });
});