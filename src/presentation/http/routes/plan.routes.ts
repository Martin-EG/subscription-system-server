import { Router } from 'express';
import type { AuthProvider, PlanRepository } from '../../../application/ports';
import { authenticate } from '../middlewares/authenticate.middleware.js';
import { createPlanController } from '../controllers';
import { GetPlansUseCase } from '../../../application/use-cases/get-plans.use-case';

export interface PlanRouterOptions {
  authProvider: AuthProvider;
  planRepository: PlanRepository;
}

export function createPlansRouter({ authProvider, planRepository }: PlanRouterOptions): Router {
  const router = Router();
  const getPlanLogsUseCase = new GetPlansUseCase(planRepository);

  router.get('/', authenticate(authProvider), createPlanController(getPlanLogsUseCase));

  return router;
}
