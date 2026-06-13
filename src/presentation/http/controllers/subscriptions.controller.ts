import type { RequestHandler } from 'express';
import type { AuthenticatedUser } from '../../../application/dtos';
import type { GetSubscriptionsUseCase } from '../../../application/use-cases';
import { paginationSchema } from '../schemas/subscriptions.schemas';

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
