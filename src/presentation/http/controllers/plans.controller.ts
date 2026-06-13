import type { RequestHandler } from 'express';
import { GetPlansUseCase } from '../../../application/use-cases/get-plans.use-case';
import { paginationSchema } from '../schemas';

export function createPlanController(getPlansUseCase: GetPlansUseCase): RequestHandler {
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

      const result = await getPlansUseCase.execute({
        page: pagination.data.page,
        limit: pagination.data.limit,
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
