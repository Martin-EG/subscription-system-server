import { PrismaPlanRepository } from '../../../../src/infrastructure/database/prisma/prisma-plan.repository';

describe('PrismaPlanRepository', () => {
  const persistedPlan = {
    id: 'plan-id',
    name: 'Premium mensual',
    price: {
      toNumber: () => 99,
    },
    currency: 'MXN',
    billingPeriod: 'MONTHLY',
  };

  it('finds and maps a plan by id', async () => {
    const findUnique = jest.fn().mockResolvedValue(persistedPlan);
    const prisma = {
      plan: {
        findUnique,
      },
    };
    const repository = new PrismaPlanRepository(prisma as never);

    await expect(repository.findById('plan-id')).resolves.toEqual({
      id: 'plan-id',
      name: 'Premium mensual',
      price: 99,
      currency: 'MXN',
      billingPeriod: 'MONTHLY',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'plan-id',
      },
    });
  });

  it('returns null when the plan does not exist', async () => {
    const prisma = {
      plan: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const repository = new PrismaPlanRepository(prisma as never);

    await expect(repository.findById('missing-plan')).resolves.toBeNull();
  });

  it('returns mapped plans with pagination and total', async () => {
    const findMany = jest.fn();
    const count = jest.fn();
    const transaction = jest.fn().mockResolvedValue([[persistedPlan], 1]);
    const prisma = {
      plan: {
        findMany,
        count,
      },
      $transaction: transaction,
    };
    const repository = new PrismaPlanRepository(prisma as never);

    await expect(repository.findAll({ page: 2, limit: 10 })).resolves.toEqual({
      items: [
        {
          id: 'plan-id',
          name: 'Premium mensual',
          price: 99,
          currency: 'MXN',
          billingPeriod: 'MONTHLY',
        },
      ],
      total: 1,
    });
    expect(findMany).toHaveBeenCalledWith({
      skip: 10,
      take: 10,
    });
    expect(count).toHaveBeenCalledWith();
  });
});
