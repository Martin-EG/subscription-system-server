import express from 'express';
import request from 'supertest';
import { ForbiddenError, NotFoundError } from '../../../../src/domain/errors';
import { errorHandler } from '../../../../src/presentation/http/middlewares';

function createApp(error: Error) {
  const app = express();
  app.get('/failure', () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe('subscription error handling', () => {
  it('returns an empty 403 response for forbidden access', async () => {
    const response = await request(createApp(new ForbiddenError())).get('/failure');

    expect(response.status).toBe(403);
    expect(response.text).toBe('');
  });

  it('returns an empty 404 response when the subscription is not found', async () => {
    const response = await request(createApp(new NotFoundError('Subscription'))).get('/failure');

    expect(response.status).toBe(404);
    expect(response.text).toBe('');
  });
});
