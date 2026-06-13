import request from 'supertest';
import type {
  AuthProvider,
  CheckoutTransactionPort,
  IdempotencyRepository,
  PaymentProcessor,
  PaymentRepository,
  PlanRepository,
  SubscriptionRepository,
} from '../src/application/ports';
import { createApp } from '../src/app.js';

/* eslint-disable @typescript-eslint/unbound-method -- Jest replaces these interface methods with bound mock functions. */

describe('HTTP application scaffold', () => {
  const authProvider: jest.Mocked<AuthProvider> = {
    login: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
  const checkoutTransaction: jest.Mocked<CheckoutTransactionPort> = {
    completeCheckout: jest.fn(),
  };
  const idempotencyRepository: jest.Mocked<IdempotencyRepository> = {
    claim: jest.fn(),
    markFailed: jest.fn(),
  };
  const paymentProcessor: jest.Mocked<PaymentProcessor> = {
    process: jest.fn(),
  };
  const paymentRepository: jest.Mocked<PaymentRepository> = {
    findByUserId: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
  };
  const planRepository: jest.Mocked<PlanRepository> = {
    findById: jest.fn(),
    findAll: jest.fn(),
  };
  const subscriptionRepository: jest.Mocked<SubscriptionRepository> = {
    findCurrentByUserId: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
  };
  const app = createApp({
    authProvider,
    checkoutTransaction,
    idempotencyRepository,
    paymentProcessor,
    paymentRepository,
    planRepository,
    subscriptionRepository,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports service health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  const placeholderRequests = [
    () => request(app).patch('/api/v1/subscriptions/cancel'),
    () => request(app).patch('/api/v1/subscriptions/renew'),
    () => request(app).get('/api/v1/subscriptions/user-placeholder'),
  ];

  it.each(placeholderRequests)('returns 501 for a business endpoint', async (sendRequest) => {
    const response = await sendRequest();

    expect(response.status).toBe(501);
    expect(response.body).toMatchObject({
      title: 'Not Implemented',
      status: 501,
    });
  });

  it('requires authentication to list payment logs', async () => {
    const response = await request(app).get('/api/v1/payments');

    expect(response.status).toBe(401);
  });

  it('requires authentication to checkout a subscription', async () => {
    const response = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Idempotency-Key', 'checkout-key')
      .send({
        planId: '0198f076-649b-752b-856b-756c32f0be8d',
        paymentMethod: 'simulated-card',
      });

    expect(response.status).toBe(401);
    expect(idempotencyRepository.claim).not.toHaveBeenCalled();
  });

  it('checks out a subscription through the configured dependencies', async () => {
    const planId = '0198f076-649b-752b-856b-756c32f0be8d';
    const processedAt = new Date('2026-06-13T12:01:00.000Z');
    const expiresAt = new Date('2026-07-13T12:01:00.000Z');

    authProvider.verifyAccessToken.mockResolvedValue({
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    });
    idempotencyRepository.claim.mockResolvedValue({
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
    });
    planRepository.findById.mockResolvedValue({
      id: planId,
      name: 'Premium monthly',
      price: 99,
      currency: 'MXN',
      billingPeriod: 'MONTHLY',
    });
    paymentProcessor.process.mockResolvedValue({
      transactionId: 'transaction-id',
      status: 'SUCCEEDED',
      processedAt,
    });
    checkoutTransaction.completeCheckout.mockResolvedValue({
      subscriptionId: 'subscription-id',
      status: 'ACTIVE',
      expiresAt,
    });

    const response = await request(app)
      .post('/api/v1/subscriptions/checkout')
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
    expect(authProvider.verifyAccessToken).toHaveBeenCalledWith('jwt-token');
    expect(planRepository.findById).toHaveBeenCalledWith(planId);
    expect(paymentProcessor.process).toHaveBeenCalledWith({
      userId: 'user-id',
      amount: 99,
      currency: 'MXN',
      paymentMethod: 'simulated-card',
      idempotencyKey: 'checkout-key',
    });
    expect(checkoutTransaction.completeCheckout).toHaveBeenCalledWith({
      userId: 'user-id',
      planId,
      idempotencyId: 'idempotency-id',
      transactionId: 'transaction-id',
      amount: 99,
      currency: 'MXN',
      startedAt: processedAt,
      expiresAt,
    });
  });
});
