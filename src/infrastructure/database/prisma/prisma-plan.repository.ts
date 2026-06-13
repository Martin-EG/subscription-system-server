import type { FindPlanQuery, PlanRepository, PlanSearchResult } from '../../../application/ports';
import type { Plan } from '../../../domain/entities';
import type { Plan as PrismaPlan, PrismaClient } from '../../../generated/prisma/client';

type MapPlanData = (plan: PrismaPlan) => Plan;
const mapPlanData: MapPlanData = (plan) => ({
  ...plan,
  price: plan.price.toNumber(),
});

export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(planId: string): Promise<Plan | null> {
    const plan = await this.prisma.plan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!plan) {
      return null;
    }

    return mapPlanData(plan);
  }

  async findAll({ page, limit }: FindPlanQuery): Promise<PlanSearchResult> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.plan.count(),
    ]);

    return {
      items: items.map((plan) => mapPlanData(plan)),
      total,
    };
  }
}
