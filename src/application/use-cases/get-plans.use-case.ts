import type { Plan } from '../../domain/entities';
import type { PaginatedPlansOutput } from '../dtos';
import type { PlanRepository } from '../ports';

interface GetPlansInput {
  page: number;
  limit: number;
}

type GetPlansOutput = Plan | PaginatedPlansOutput;

export class GetPlansUseCase {
  constructor(private readonly planRepository: PlanRepository) {}

  async execute({ page, limit }: GetPlansInput): Promise<GetPlansOutput> {
    const { items, total } = await this.planRepository.findAll({ page, limit });

    return {
      data: items,
      total,
      page,
      limit,
    };
  }
}
