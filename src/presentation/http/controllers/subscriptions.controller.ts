import type { RequestHandler } from 'express';
import type { AuthenticatedUser, RenewSubscriptionInput } from '../../../application/dtos';
import type {
  CancelSubscriptionUseCase,
  GetSubscriptionsUseCase,
  RenewSubscriptionUseCase,
} from '../../../application/use-cases';
import { paginationSchema } from '../schemas/subscriptions.schemas';

export function createCancelSubscriptionController(
  cancelSubscriptionUseCase: CancelSubscriptionUseCase,
): RequestHandler {
  return async (_request, response, next) => {
    try {
      const currentUser = response.locals.authUser as AuthenticatedUser;
      const result = await cancelSubscriptionUseCase.execute(currentUser.id);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export function createRenewSubscriptionController(
  renewSubscriptionUseCase: RenewSubscriptionUseCase,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const currentUser = response.locals.authUser as AuthenticatedUser;
      const body = request.body as Omit<RenewSubscriptionInput, 'userId'>;
      const result = await renewSubscriptionUseCase.execute({
        userId: currentUser.id,
        ...body,
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export function createSubscriptionsController(
  getSubscriptionsUseCase: GetSubscriptionsUseCase,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const pagination = paginationSchema.safeParse(request.query);

      if (!pagination.success) {
        response.status(400).json({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
        });

        return;
      }

      const currentUser = response.locals.authUser as AuthenticatedUser;
      const result = await getSubscriptionsUseCase.execute({
        currentUser,
        page: pagination.data.page,
        limit: pagination.data.limit,
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
