import type { RequestHandler } from 'express';
import type { SubscriptionPaginationInput } from '../../../application/dtos';
import type { GetSubscriptionsUseCase } from '../../../application/use-cases';

export function createSubscriptionsController(
  getSubscriptionsUseCase: GetSubscriptionsUseCase
): RequestHandler {
  return async (request, response, next) => {
    try {
      const { page, limit } = request.params as unknown as SubscriptionPaginationInput;

      const result = getSubscriptionsUseCase.execute({ 
        currentUser: response.locals.authUser, 
        page: page,
        limit: limit
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
    
  }
}