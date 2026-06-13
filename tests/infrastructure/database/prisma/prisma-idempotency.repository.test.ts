jest.mock('../../../../src/generated/prisma/client.js', () => ({
  Prisma: {
    DbNull: 'DB_NULL',
  },
}));

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
  ])('$name after a duplicate key conflict', async ({ existing, expected }) => {
    const findUniqueOrThrow = jest.fn().mockResolvedValue(existing);
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = {
      idempotencyKey: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findUniqueOrThrow,
        updateMany,
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

  it('reclaims an expired idempotency operation', async () => {
    const expiredRecord = {
      ...record,
      expiresAt: new Date('2026-06-12T12:00:00.000Z'),
    };
    const reclaimedRecord = {
      ...record,
      expiresAt: input.expiresAt,
    };
    const findUniqueOrThrow = jest
      .fn()
      .mockResolvedValueOnce(expiredRecord)
      .mockResolvedValueOnce(reclaimedRecord);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      idempotencyKey: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findUniqueOrThrow,
        updateMany,
      },
    };
    const repository = new PrismaIdempotencyRepository(prisma as never);

    await expect(repository.claim(input)).resolves.toEqual({
      outcome: 'CLAIMED',
      record: reclaimedRecord,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: expiredRecord.id,
        requestHash: input.requestHash,
        OR: [
          { status: 'FAILED' },
          {
            status: 'PROCESSING',
            expiresAt: { lte: now },
          },
        ],
      },
      data: {
        status: 'PROCESSING',
        expiresAt: input.expiresAt,
        responseStatus: null,
        responseBody: 'DB_NULL',
        resourceId: null,
      },
    });
    expect(findUniqueOrThrow).toHaveBeenLastCalledWith({
      where: { id: expiredRecord.id },
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
