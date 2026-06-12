import type { RequestHandler } from 'express';

export const notImplemented: RequestHandler = (request, response) => {
  response.status(501).json({
    type: 'about:blank',
    title: 'Not Implemented',
    status: 501,
    detail: `Placeholder for ${request.method} ${request.originalUrl}`,
  });
};
