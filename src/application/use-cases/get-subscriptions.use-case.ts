import { NotFoundError } from '../../domain/errors';
import type {
  AuthenticatedUser,
  SubscriptionDetailsOutput,
  PaginatedSubscriptionsOutput,
} from '../dtos';
import type { SubscriptionRepository } from '../ports';

interface GetSubscriptionsInput {
  currentUser: AuthenticatedUser;
  page: number;
  limit: number;
}

type GetSubscriptionsOutput = SubscriptionDetailsOutput | PaginatedSubscriptionsOutput;

export class GetSubscriptionsUseCase {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  async execute({
    currentUser,
    page,
    limit,
  }: GetSubscriptionsInput): Promise<GetSubscriptionsOutput> {
    if (currentUser.role === 'ADMIN') {
      const { items, total } = await this.subscriptionRepository.findAll({ page, limit });

      return {
        data: items,
        total,
        page,
        limit,
      };
    }

    const subscription = await this.subscriptionRepository.findByUserId(currentUser.id);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    return subscription;
  }
}
