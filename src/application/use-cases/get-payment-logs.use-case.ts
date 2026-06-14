import { ForbiddenError } from '../../domain/errors';
import type { AuthenticatedUser, PaginatedPaymentsOutput } from '../dtos';
import type { PaymentRepository } from '../ports';

interface GetSubscriptionsInput {
  currentUser: AuthenticatedUser;
  page: number;
  limit: number;
}

export class GetPaymentLogsUseCase {
  constructor(private readonly paymentRepository: PaymentRepository) {}

  async execute({
    currentUser,
    page,
    limit,
  }: GetSubscriptionsInput): Promise<PaginatedPaymentsOutput> {
    if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError();
    }

    const { items, total } = await this.paymentRepository.findAll({ page, limit });

    return {
      data: items,
      total,
      page,
      limit,
    };
  }
}
