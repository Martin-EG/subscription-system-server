import express from 'express';
import request from 'supertest';
import type { CheckoutSubscriptionUseCase } from '../../../../src/application/use-cases';
import { NotFoundError } from '../../../../src/domain/errors';
import { createCheckoutSubscriptionController } from '../../../../src/presentation/http/controllers';
import { errorHandler } from '../../../../src/presentation/http/middlewares';

function createApp(execute: jest.Mock) {
  const app = express();
  const useCase = { execute } as unknown as CheckoutSubscriptionUseCase;

  app.use(express.json());
  app.use((_request, response, next) => {
    response.locals.authUser = {
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    };
    next();
  });
  app.post('/checkout', createCheckoutSubscriptionController(useCase));
  app.use(errorHandler);

  return app;
}

describe('createCheckoutSubscriptionController', () => {
  const planId = '0198f076-649b-752b-856b-756c32f0be8d';

  it('passes the authenticated user, request body, and idempotency key to the use case', async () => {
    const expiresAt = new Date('2026-07-13T12:01:00.000Z');
    const execute = jest.fn().mockResolvedValue({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt,
    });

    const response = await request(createApp(execute))
      .post('/checkout')
      .set('Idempotency-Key', 'checkout-key')
      .send({
        planId,
        paymentMethod: 'simulated-card',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt: expiresAt.toISOString(),
    });
    expect(execute).toHaveBeenCalledWith({
      userId: 'user-id',
      planId,
      paymentMethod: 'simulated-card',
      idempotencyKey: 'checkout-key',
    });
  });

  it('returns 400 when the checkout body is invalid', async () => {
    const execute = jest.fn();

    const response = await request(createApp(execute))
      .post('/checkout')
      .set('Idempotency-Key', 'checkout-key')
      .send({
        planId: 'not-a-uuid',
        paymentMethod: '',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'missing',
      configureRequest: (requestBuilder: request.Test) => requestBuilder,
    },
    {
      name: 'blank',
      configureRequest: (requestBuilder: request.Test) =>
        requestBuilder.set('Idempotency-Key', '   '),
    },
  ])('returns 400 when the idempotency key is $name', async ({ configureRequest }) => {
    const execute = jest.fn();
    const requestBuilder = request(createApp(execute)).post('/checkout').send({
      planId,
      paymentMethod: 'simulated-card',
    });

    const response = await configureRequest(requestBuilder);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('forwards use-case errors to the error handler', async () => {
    const execute = jest.fn().mockRejectedValue(new NotFoundError('Plan'));

    const response = await request(createApp(execute))
      .post('/checkout')
      .set('Idempotency-Key', 'checkout-key')
      .send({
        planId,
        paymentMethod: 'simulated-card',
      });

    expect(response.status).toBe(404);
    expect(response.text).toBe('');
  });
});
