import express from 'express';
import request from 'supertest';
import type { SubscriptionDetailsOutput } from '../../../../src/application/dtos';
import type {
  GetSubscriptionByUserIdUseCase,
  GetSubscriptionsUseCase,
} from '../../../../src/application/use-cases';
import {
  createSubscriptionByUserIdController,
  createSubscriptionsController,
} from '../../../../src/presentation/http/controllers/subscriptions.controller';
import { errorHandler } from '../../../../src/presentation/http/middlewares';

describe('createSubscriptionsController', () => {
  const subscription: SubscriptionDetailsOutput = {
    subscriptionId: 'subscription-id',
    userId: 'user-id',
    userName: 'Jane Doe',
    userEmail: 'jane@example.com',
    status: 'ACTIVE',
    plan: {
      id: 'plan-id',
      name: 'Premium mensual',
      price: 99,
      currency: 'MXN',
      billingPeriod: 'MONTHLY',
    },
    startedAt: new Date('2026-06-12T00:00:00.000Z'),
    expiresAt: null,
    cancelAtPeriodEnd: false,
  };

  it('passes the authenticated user and parsed query pagination to the use case', async () => {
    const execute = jest.fn().mockResolvedValue(subscription);
    const useCase = { execute } as unknown as GetSubscriptionsUseCase;
    const app = express();

    app.use((_request, response, next) => {
      response.locals.authUser = {
        id: 'user-id',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'USER',
      };
      next();
    });
    app.get('/subscriptions', createSubscriptionsController(useCase));
    app.use(errorHandler);

    const response = await request(app).get('/subscriptions?page=2&limit=25');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      subscriptionId: 'subscription-id',
      userId: 'user-id',
    });
    expect(execute).toHaveBeenCalledWith({
      currentUser: {
        id: 'user-id',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'USER',
      },
      page: 2,
      limit: 25,
    });
  });

  it('passes the authenticated admin and target user id to the use case', async () => {
    const targetUserId = '550e8400-e29b-41d4-a716-446655440000';
    const execute = jest.fn().mockResolvedValue({ ...subscription, userId: targetUserId });
    const useCase = { execute } as unknown as GetSubscriptionByUserIdUseCase;
    const app = express();

    app.use((_request, response, next) => {
      response.locals.authUser = {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
      };
      next();
    });
    app.get('/subscriptions/:userId', createSubscriptionByUserIdController(useCase));
    app.use(errorHandler);

    const response = await request(app).get(`/subscriptions/${targetUserId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      subscriptionId: 'subscription-id',
      userId: targetUserId,
    });
    expect(execute).toHaveBeenCalledWith({
      currentUser: {
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'ADMIN',
      },
      targetUserId,
    });
  });

  it('returns 400 without executing the use case when user id is invalid', async () => {
    const execute = jest.fn();
    const useCase = { execute } as unknown as GetSubscriptionByUserIdUseCase;
    const app = express();

    app.get('/subscriptions/:userId', createSubscriptionByUserIdController(useCase));
    app.use(errorHandler);

    const response = await request(app).get('/subscriptions/not-a-uuid');

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
