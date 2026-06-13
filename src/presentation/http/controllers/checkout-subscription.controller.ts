import type { RequestHandler } from 'express';
import type { CheckoutSubscriptionUseCase } from '../../../application/use-cases/checkout-subscription.use-case';
import type { AuthenticatedUser } from '../../../application/dtos';
import { checkoutSubscriptionSchema, idempotencyKeySchema } from '../schemas';

export function createCheckoutSubscriptionController(
  checkoutSubscriptionUseCase: CheckoutSubscriptionUseCase,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const checkoutInput = checkoutSubscriptionSchema.safeParse(request.body);

      if (!checkoutInput.success) {
        response.status(400).json({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
        });

        return;
      }

      const idempotencyKey = idempotencyKeySchema.safeParse(request.headers['idempotency-key']);

      if (!idempotencyKey.success) {
        response.status(400).json({
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
        });

        return;
      }

      const currentUser = response.locals.authUser as AuthenticatedUser;
      const result = await checkoutSubscriptionUseCase.execute({
        userId: currentUser.id,
        planId: checkoutInput.data.planId,
        paymentMethod: checkoutInput.data.paymentMethod,
        idempotencyKey: idempotencyKey.data,
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
