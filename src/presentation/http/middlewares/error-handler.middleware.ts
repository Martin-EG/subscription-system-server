import type { ErrorRequestHandler } from 'express';
import {
  ForbiddenError, 
  NotFoundError, 
  NotImplementedError, 
  UnauthorizedError 
} from '../../../domain/errors';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof UnauthorizedError) {
    response.status(401).end();
    return;
  }

  if(error instanceof ForbiddenError) {
    response.status(403).end();
    return;
  }

  if(error instanceof NotFoundError) {
    response.status(404).end();
    return;
  }

  if (error instanceof NotImplementedError) {
    response.status(501).json({
      type: 'about:blank',
      title: 'Not Implemented',
      status: 501,
      detail: error.message,
    });
    return;
  }

  response.status(500).json({
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
  });
};
