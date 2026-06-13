import express from 'express';
import request from 'supertest';
import type {
  AuthProvider,
  CheckoutTransactionPort,
  IdempotencyRepository,
  PaymentProcessor,
  PlanRepository,
  RenewalTransactionPort,
  SubscriptionRepository,
} from '../../../../src/application/ports';
import { errorHandler } from '../../../../src/presentation/http/middlewares';
import { createSubscriptionRouter } from '../../../../src/presentation/http/routes';

/* eslint-disable @typescript-eslint/unbound-method -- Jest replaces these interface methods with bound mock functions. */

function createDependencies() {
  const planId = '0198f076-649b-752b-856b-756c32f0be8d';
  const processedAt = new Date('2026-06-13T12:01:00.000Z');
  const expiresAt = new Date('2026-07-13T12:01:00.000Z');
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
  const authProvider: jest.Mocked<AuthProvider> = {
    login: jest.fn(),
    verifyAccessToken: jest.fn().mockResolvedValue({
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    }),
  };
  const checkoutTransaction: jest.Mocked<CheckoutTransactionPort> = {
    completeCheckout: jest.fn().mockResolvedValue({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt,
    }),
  };
  const idempotencyRepository: jest.Mocked<IdempotencyRepository> = {
    claim: jest.fn().mockResolvedValue({
      outcome: 'CLAIMED',
      record: {
        id: 'idempotency-id',
        key: 'checkout-key',
        userId: 'user-id',
        operation: 'CHECKOUT',
        requestHash: 'request-hash',
        status: 'PROCESSING',
        responseStatus: null,
        responseBody: null,
        resourceId: null,
        createdAt: new Date('2026-06-13T12:00:00.000Z'),
        expiresAt: new Date('2026-06-13T12:05:00.000Z'),
      },
    }),
    markFailed: jest.fn(),
  };
  const paymentProcessor: jest.Mocked<PaymentProcessor> = {
    process: jest.fn().mockResolvedValue({
      transactionId: 'transaction-id',
      status: 'SUCCEEDED',
      processedAt,
    }),
  };
  const planRepository: jest.Mocked<PlanRepository> = {
    findById: jest.fn().mockResolvedValue({
      id: planId,
      name: 'Premium monthly',
      price: 99,
      currency: 'MXN',
      billingPeriod: 'MONTHLY',
    }),
    findAll: jest.fn(),
  };
  const renewalTransaction: jest.Mocked<RenewalTransactionPort> = {
    completeRenewal: jest.fn().mockResolvedValue({
      subscriptionId: 'premium-subscription-id',
      status: 'ACTIVE',
      expiresAt,
      cancelAtPeriodEnd: false,
    }),
  };
  const findCurrentByUserId = jest.fn().mockResolvedValue(subscription);
  const renewableSubscription = {
    subscriptionId: 'premium-subscription-id',
    userId: 'user-id',
    planId: 'premium-plan-id',
    status: 'ACTIVE' as const,
    startedAt: new Date('2026-06-12T00:00:00.000Z'),
    expiresAt: new Date('2026-07-12T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    billingPeriod: 'MONTHLY' as const,
    price: 99,
    currency: 'MXN',
  };
  const findRenewableByUserId = jest.fn().mockResolvedValue(renewableSubscription);
  const scheduleCancellation = jest.fn().mockResolvedValue({
    subscriptionId: renewableSubscription.subscriptionId,
    status: 'ACTIVE',
    expiresAt: renewableSubscription.expiresAt,
    cancelAtPeriodEnd: true,
  });
  const renew = jest.fn().mockResolvedValue({
    subscriptionId: renewableSubscription.subscriptionId,
    status: 'ACTIVE',
    expiresAt: renewableSubscription.expiresAt,
    cancelAtPeriodEnd: false,
  });
  const subscriptionRepository: SubscriptionRepository = {
    findCurrentByUserId,
    findRenewableByUserId,
    findAll: jest.fn(),
    scheduleCancellation,
    renew,
    save: jest.fn(),
  };

  return {
    authProvider,
    checkoutTransaction,
    idempotencyRepository,
    paymentProcessor,
    planRepository,
    renewalTransaction,
    subscriptionRepository,
    planId,
    processedAt,
    expiresAt,
    findCurrentByUserId,
    findRenewableByUserId,
    scheduleCancellation,
    renew,
  };
}

function createApp() {
  const dependencies = createDependencies();
  const app = express();
  app.use(express.json());
  app.use(
    '/subscriptions',
    createSubscriptionRouter({
      authProvider: dependencies.authProvider,
      checkoutTransaction: dependencies.checkoutTransaction,
      idempotencyRepository: dependencies.idempotencyRepository,
      paymentProcessor: dependencies.paymentProcessor,
      planRepository: dependencies.planRepository,
      renewalTransaction: dependencies.renewalTransaction,
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
    const { app, subscriptionRepository } = createApp();

    const response = await request(app)
      .get('/subscriptions')
      .set('Authorization', 'Bearer jwt-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ subscriptionId: 'subscription-id' });
    expect(subscriptionRepository.findCurrentByUserId).toHaveBeenCalledWith('user-id');
  });

  it('returns 400 for invalid pagination', async () => {
    const { app } = createApp();

    const response = await request(app)
      .get('/subscriptions?page=0&limit=101')
      .set('Authorization', 'Bearer jwt-token');

    expect(response.status).toBe(400);
  });

  it('requires a bearer token to checkout a subscription', async () => {
    const { app, planId, idempotencyRepository } = createApp();

    const response = await request(app)
      .post('/subscriptions/checkout')
      .set('Idempotency-Key', 'checkout-key')
      .send({
        planId,
        paymentMethod: 'simulated-card',
      });

    expect(response.status).toBe(401);
    expect(idempotencyRepository.claim).not.toHaveBeenCalled();
  });

  it('returns 400 when the checkout request is invalid', async () => {
    const { app, idempotencyRepository } = createApp();

    const response = await request(app)
      .post('/subscriptions/checkout')
      .set('Authorization', 'Bearer jwt-token')
      .send({
        planId: 'not-a-uuid',
        paymentMethod: '',
      });

    expect(response.status).toBe(400);
    expect(idempotencyRepository.claim).not.toHaveBeenCalled();
  });

  it('routes a valid checkout through its dependencies', async () => {
    const { app, planId, expiresAt, planRepository, paymentProcessor, checkoutTransaction } =
      createApp();

    const response = await request(app)
      .post('/subscriptions/checkout')
      .set('Authorization', 'Bearer jwt-token')
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
    expect(planRepository.findById).toHaveBeenCalledWith(planId);
    expect(paymentProcessor.process).toHaveBeenCalledWith({
      userId: 'user-id',
      amount: 99,
      currency: 'MXN',
      paymentMethod: 'simulated-card',
      idempotencyKey: 'checkout-key',
    });
    expect(checkoutTransaction.completeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        planId,
        idempotencyId: 'idempotency-id',
        transactionId: 'transaction-id',
      }),
    );
  });

  it('schedules cancellation for the authenticated user', async () => {
    const { app, scheduleCancellation } = createApp();

    const response = await request(app)
      .patch('/subscriptions/cancel')
      .set('Authorization', 'Bearer jwt-token');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      subscriptionId: 'premium-subscription-id',
      cancelAtPeriodEnd: true,
    });
    expect(scheduleCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-id' }),
    );
  });

  it('renews without accepting a plan selection', async () => {
    const { app, findRenewableByUserId, renewalTransaction } = createApp();
    findRenewableByUserId.mockResolvedValueOnce({
      ...(await findRenewableByUserId()),
      status: 'PAST_DUE',
    });

    const response = await request(app)
      .patch('/subscriptions/renew')
      .set('Authorization', 'Bearer jwt-token')
      .send({
        paymentMethod: 'pm_test',
        idempotencyKey: 'renew-request-1',
      });

    expect(response.status).toBe(200);
    expect(renewalTransaction.completeRenewal).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'premium-subscription-id',
        userId: 'user-id',
        payment: expect.objectContaining({
          transactionId: 'transaction-id',
        }) as unknown,
      }),
    );
  });

  it('rejects renewal bodies that select a plan', async () => {
    const { app } = createApp();

    const response = await request(app)
      .patch('/subscriptions/renew')
      .set('Authorization', 'Bearer jwt-token')
      .send({
        paymentMethod: 'pm_test',
        idempotencyKey: 'renew-request-1',
        planId: 'another-plan-id',
      });

    expect(response.status).toBe(400);
  });
});
