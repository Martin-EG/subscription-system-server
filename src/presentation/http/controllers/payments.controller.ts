import type { RequestHandler } from 'express';
import type { GetPaymentLogsUseCase } from '../../../application/use-cases/get-payment-logs.use-case';
import { paginationSchema } from '../schemas';
import type { AuthenticatedUser } from '../../../application/dtos';

export function createPaymentLogsController(
  getPaymentLogsUseCase: GetPaymentLogsUseCase,
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
      const result = await getPaymentLogsUseCase.execute({
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
