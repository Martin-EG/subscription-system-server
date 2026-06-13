import { PrismaIdempotencyRepository } from '../../../../src/infrastructure/database/prisma/prisma-idempotency.repository';

describe('PrismaIdempotencyRepository', () => {
  const now = new Date('2026-06-13T12:00:00.000Z');
  const input = {
    key: 'checkout-key',
    userId: 'user-id',
    operation: 'CHECKOUT' as const,
    requestHash: 'request-hash',
    expiresAt: new Date('2026-06-14T12:00:00.000Z'),
  };
  const record = {
    id: 'idempotency-id',
    ...input,
    status: 'PROCESSING',
    responseStatus: null,
    responseBody: null,
    resourceId: null,
    createdAt: now,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('claims a new idempotency key', async () => {
    const create = jest.fn().mockResolvedValue(record);
    const prisma = {
      idempotencyKey: {
        create,
      },
    };
    const repository = new PrismaIdempotencyRepository(prisma as never);

    await expect(repository.claim(input)).resolves.toEqual({
      outcome: 'CLAIMED',
      record,
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        ...input,
        status: 'PROCESSING',
      },
    });
  });

  it.each([
    {
      name: 'reports a payload mismatch',
      existing: { ...record, requestHash: 'different-hash' },
      expected: { outcome: 'PAYLOAD_MISMATCH' },
    },
    {
      name: 'reports an operation still in progress',
      existing: record,
      expected: { outcome: 'IN_PROGRESS' },
    },
    {
      name: 'replays a completed response',
      existing: {
        ...record,
        status: 'COMPLETED',
        responseStatus: 201,
        responseBody: { subscriptionId: 'subscription-id' },
      },
      expected: {
        outcome: 'REPLAY',
        responseStatus: 201,
        responseBody: { subscriptionId: 'subscription-id' },
      },
    },
    {
      name: 'reports a failed or expired operation',
      existing: {
        ...record,
        expiresAt: new Date('2026-06-12T12:00:00.000Z'),
      },
      expected: { outcome: 'FAILED' },
    },
  ])('$name after a duplicate key conflict', async ({ existing, expected }) => {
    const findUniqueOrThrow = jest.fn().mockResolvedValue(existing);
    const prisma = {
      idempotencyKey: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findUniqueOrThrow,
      },
    };
    const repository = new PrismaIdempotencyRepository(prisma as never);

    await expect(repository.claim(input)).resolves.toEqual(expected);
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        userId_operation_key: {
          userId: input.userId,
          operation: input.operation,
          key: input.key,
        },
      },
    });
  });

  it('propagates errors other than unique constraint conflicts', async () => {
    const error = new Error('database unavailable');
    const prisma = {
      idempotencyKey: {
        create: jest.fn().mockRejectedValue(error),
      },
    };
    const repository = new PrismaIdempotencyRepository(prisma as never);

    await expect(repository.claim(input)).rejects.toBe(error);
  });

  it('marks an idempotency operation as failed', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      idempotencyKey: {
        update,
      },
    };
    const repository = new PrismaIdempotencyRepository(prisma as never);

    await expect(repository.markFailed('idempotency-id')).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'idempotency-id',
      },
      data: {
        status: 'FAILED',
      },
    });
  });
});
