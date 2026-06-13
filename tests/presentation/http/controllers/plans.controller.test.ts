import express from "express";
import request from 'supertest';
import { PaginatedPlansOutput } from "../../../../src/application/dtos";
import { GetPlansUseCase } from "../../../../src/application/use-cases/get-plans.use-case";
import { createPlanController } from '../../../../src/presentation/http/controllers';
import { errorHandler } from '../../../../src/presentation/http/middlewares';

describe('createPlansController', () => {
    const paginatedPlans: PaginatedPlansOutput = {
        data: [
           { 
                id: 'plan-1',
                name: 'plan-1',
                price: 99,
                currency: 'MXN',
                billingPeriod: 'MONTHLY'
            }
        ],
        page: 1,
        limit: 20,
        total: 1
    };

    it('passes the authenticated user and parsed query pagination to the use case', async () => {
        const execute = jest.fn().mockResolvedValue(paginatedPlans);
        const useCase = { execute } as unknown as GetPlansUseCase;
        const app = express();

        app.use((_request, response, next) => {
            response.locals.authUser = {
                id: 'user-id',
                email: 'jane@example.com',
                name: 'Jane Doe',
                role: 'USER',
            };
            next();
        });
        app.get('/plans', createPlanController(useCase));
        app.use(errorHandler);

        const response = await request(app).get('/plans?page=1&limit=20');

        expect(response.status).toBe(200);
        expect(execute).toHaveBeenCalledWith({
            page: 1,
            limit: 20,
        });
    });
});