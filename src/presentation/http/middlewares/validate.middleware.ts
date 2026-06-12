import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export function validateBody(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
      });
      return;
    }

    request.body = result.data;
    next();
  };
}
