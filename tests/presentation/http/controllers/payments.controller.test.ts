import express from 'express';
import request from 'supertest';
import type { GetPaymentLogsUseCase } from '../../../../src/application/use-cases';
import type { PaymentLog } from '../../../../src/domain/entities';
import { createPaymentLogsController } from '../../../../src/presentation/http/controllers';
import { errorHandler } from '../../../../src/presentation/http/middlewares';

describe('createPaymentLogsController', () => {
  function createApp(execute: jest.Mock) {
    const app = express();
    const useCase = { execute } as unknown as GetPaymentLogsUseCase;

    app.use((_request, response, next) => {
      response.locals.authUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      };

      next();
    });
    app.get('/payments', createPaymentLogsController(useCase));
    app.use(errorHandler);

    return app;
  }

  it('returns paginated payment logs when the query is valid', async () => {
    const paymentDate = new Date('2026-06-13T12:00:00.000Z');
    const execute = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'payment-log-id',
          userId: 'user-id',
          subscriptionId: 'subscription-id',
          amount: 99,
          currency: 'MXN',
          status: 'SUCCEEDED',
          paymentDate,
          transactionId: 'transaction-id',
        },
      ] as PaymentLog[],
      total: 1,
      page: 1,
      limit: 10,
    });

    const response = await request(createApp(execute)).get('/payments?page=1&limit=10');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: 'payment-log-id',
          userId: 'user-id',
          subscriptionId: 'subscription-id',
          amount: 99,
          currency: 'MXN',
          status: 'SUCCEEDED',
          paymentDate: paymentDate.toISOString(),
          transactionId: 'transaction-id',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });

    expect(execute).toHaveBeenCalledWith({
      currentUser: {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      },
      page: 1,
      limit: 10,
    });
  });

  it('returns 400 when pagination parameters are invalid', async () => {
    const execute = jest.fn();

    const response = await request(createApp(execute)).get('/payments?page=not-a-number&limit=10');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('forwards unexpected errors to the global error handler', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('unexpected'));

    const response = await request(createApp(execute)).get('/payments?page=1&limit=10');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
  });
});
