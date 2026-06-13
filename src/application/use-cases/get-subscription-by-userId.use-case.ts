import { ForbiddenError, NotFoundError } from '../../domain/errors';
import type { AuthenticatedUser, SubscriptionDetailsOutput } from '../dtos';
import type { SubscriptionRepository } from '../ports';

interface GetSubscriptionByUserIdInput {
  currentUser: AuthenticatedUser;
  targetUserId: string;
}

type GetSubscriptionByUserIdOutput = SubscriptionDetailsOutput;

export class GetSubscriptionByUserIdUseCase {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  async execute({
    currentUser,
    targetUserId,
  }: GetSubscriptionByUserIdInput): Promise<GetSubscriptionByUserIdOutput> {
    if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError();
    }

    const subscription = await this.subscriptionRepository.findByUserId(targetUserId);

    if (!subscription) {
      throw new NotFoundError('Subscription');
    }

    return subscription;
  }
}
