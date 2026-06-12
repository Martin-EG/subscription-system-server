import express from 'express';
import request from 'supertest';
import type { AuthProvider, SubscriptionRepository } from '../../../../src/application/ports';
import { errorHandler } from '../../../../src/presentation/http/middlewares';
import { createSubscriptionRouter } from '../../../../src/presentation/http/routes';

function createDependencies() {
  const subscription = {
    subscriptionId: 'subscription-id',
    userId: 'user-id',
    userName: 'Jane Doe',
    userEmail: 'jane@example.com',
    status: 'ACTIVE' as const,
    plan: {
      id: 'plan-id',
      name: 'Gratis',
      price: 0,
      currency: 'MXN',
      billingPeriod: null,
    },
    startedAt: new Date('2026-06-12T00:00:00.000Z'),
    expiresAt: null,
    cancelAtPeriodEnd: false,
  };
  const authProvider: AuthProvider = {
    login: jest.fn(),
    verifyAccessToken: jest.fn().mockResolvedValue({
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    }),
  };
  const findCurrentByUserId = jest.fn().mockResolvedValue(subscription);
  const subscriptionRepository: SubscriptionRepository = {
    findCurrentByUserId,
    findAll: jest.fn(),
    save: jest.fn(),
  };

  return { authProvider, subscriptionRepository, findCurrentByUserId };
}

function createApp() {
  const dependencies = createDependencies();
  const app = express();
  app.use(
    '/subscriptions',
    createSubscriptionRouter({
      authProvider: dependencies.authProvider,
      subscriptionRepository: dependencies.subscriptionRepository,
    }),
  );
  app.use(errorHandler);
  return { app, ...dependencies };
}

describe('createSubscriptionRouter', () => {
  it('requires a bearer token', async () => {
    const { app } = createApp();

    const response = await request(app).get('/subscriptions');

    expect(response.status).toBe(401);
  });

  it('returns the current subscription with default pagination', async () => {
    const { app, findCurrentByUserId } = createApp();

    const response = await request(app)
      .get('/subscriptions')
      .set('Authorization', 'Bearer jwt-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ subscriptionId: 'subscription-id' });
    expect(findCurrentByUserId).toHaveBeenCalledWith('user-id');
  });

  it('returns 400 for invalid pagination', async () => {
    const { app } = createApp();

    const response = await request(app)
      .get('/subscriptions?page=0&limit=101')
      .set('Authorization', 'Bearer jwt-token');

    expect(response.status).toBe(400);
  });
});
