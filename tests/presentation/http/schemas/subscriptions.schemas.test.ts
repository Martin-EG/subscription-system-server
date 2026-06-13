import {
  checkoutSubscriptionSchema,
  idempotencyKeySchema,
  paginationSchema,
  renewSubscriptionBodySchema,
} from '../../../../src/presentation/http/schemas/subscriptions.schemas';

describe('paginationSchema', () => {
  it('applies pagination defaults', () => {
    expect(paginationSchema.parse({})).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('coerces valid query string values', () => {
    expect(paginationSchema.parse({ page: '2', limit: '50' })).toEqual({
      page: 2,
      limit: 50,
    });
  });

  it.each([
    { page: '0', limit: '20' },
    { page: '1', limit: '0' },
    { page: '1', limit: '101' },
    { page: 'invalid', limit: '20' },
  ])('rejects invalid pagination: %p', (query) => {
    expect(paginationSchema.safeParse(query).success).toBe(false);
  });
});

describe('checkoutSubscriptionSchema', () => {
  const query = {
    planId: '550e8400-e29b-41d4-a716-446655440000',
    paymentMethod: 'debit-card',
  };

  it('rejects when payment method is empty', () => {
    expect(
      checkoutSubscriptionSchema.safeParse({
        ...query,
        paymentMethod: null,
      }).success,
    ).toBe(false);
  });

  it('rejects when payment method is not the expected type', () => {
    expect(
      checkoutSubscriptionSchema.safeParse({
        ...query,
        paymentMethod: 5,
      }).success,
    ).toBe(false);
  });

  it('rejects when planId is empty', () => {
    expect(
      checkoutSubscriptionSchema.safeParse({
        ...query,
        planId: null,
      }).success,
    ).toBe(false);
  });

  it('rejects when plan id is not the expected type', () => {
    expect(
      checkoutSubscriptionSchema.safeParse({
        ...query,
        planId: 'not-an-uuid',
      }).success,
    ).toBe(false);
  });

  it('rejects when plan id is not a UUID', () => {
    expect(
      checkoutSubscriptionSchema.safeParse({
        ...query,
        planId: 5,
      }).success,
    ).toBe(false);
  });

  it('accepts valid data with the correct type', () => {
    expect(checkoutSubscriptionSchema.safeParse(query).success).toBe(true);
  });
});

describe('idempotencyKeySchema', () => {
  it('accepts a valid idempotency key', () => {
    const result = idempotencyKeySchema.safeParse('checkout-user-123-request-456');

    expect(result.success).toBe(true);
  });

  it.each([
    ['empty key', ''],
    ['whitespace only', '  '],
    ['more than 255 characters', 'a'.repeat(256)],
    ['number', 123],
    ['undefined', undefined],
    ['null', null],
  ])('rejects %s', (_case, input) => {
    const result = idempotencyKeySchema.safeParse(input);

    expect(result.success).toBe(false);
  });
});

describe('renewSubscriptionBodySchema', () => {
  it('accepts checkout-like renewal data', () => {
    expect(
      renewSubscriptionBodySchema.parse({
        paymentMethod: 'pm_test',
        idempotencyKey: 'renew-request-1',
      }),
    ).toEqual({
      paymentMethod: 'pm_test',
      idempotencyKey: 'renew-request-1',
    });
  });

  it('rejects missing, short, or additional values', () => {
    expect(renewSubscriptionBodySchema.safeParse({ paymentMethod: '' }).success).toBe(false);
    expect(
      renewSubscriptionBodySchema.safeParse({
        paymentMethod: 'pm_test',
        idempotencyKey: 'short',
      }).success,
    ).toBe(false);
    expect(
      renewSubscriptionBodySchema.safeParse({
        paymentMethod: 'pm_test',
        idempotencyKey: 'renew-request-1',
        planId: 'must-not-be-selected',
      }).success,
    ).toBe(false);
  });
});
