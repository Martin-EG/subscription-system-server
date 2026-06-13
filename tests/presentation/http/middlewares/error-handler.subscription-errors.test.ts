import express from 'express';
import request from 'supertest';
import {
  ConflictError,
  ForbiddenError,
  IdempotencyConflictError,
  IdempotencyInProgressError,
  InvalidPlanForCheckoutError,
  NotFoundError,
  PaymentDeclinedError,
  UnauthorizedError,
} from '../../../../src/domain/errors';
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
  it('returns an empty 401 response for unauthorized', async () => {
    const response = await request(createApp(new UnauthorizedError())).get('/failure');

    expect(response.status).toBe(401);
    expect(response.text).toBe('');
  });

  it('returns an empty 402 response for payment declined', async () => {
    const response = await request(createApp(new PaymentDeclinedError())).get('/failure');

    expect(response.status).toBe(402);
    expect(response.text).toBe('');
  });

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

  it('returns an empty 409 response for idempotency conflict', async () => {
    const response = await request(createApp(new IdempotencyConflictError())).get('/failure');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'IdempotencyConflict',
    });
  });

  it('returns an empty 409 response for idempotency in progress', async () => {
    const response = await request(createApp(new IdempotencyInProgressError())).get('/failure');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'IdempotencyInProgress',
    });
  });

  it('returns an empty 422 response for invalid plan for checkout', async () => {
    const response = await request(createApp(new InvalidPlanForCheckoutError())).get('/failure');

    expect(response.status).toBe(422);
    expect(response.text).toBe('');
  });

  it('returns problem details for subscription conflicts', async () => {
    const response = await request(createApp(new ConflictError('Not renewable'))).get('/failure');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Not renewable',
    });
  });
});
