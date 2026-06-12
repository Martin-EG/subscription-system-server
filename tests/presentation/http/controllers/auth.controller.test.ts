import express from 'express';
import request from 'supertest';
import type { AuthProvider } from '../../../../src/application/ports/auth-provider.port.js';
import { LoginUseCase } from '../../../../src/application/use-cases/login.use-case.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';
import { createLoginController } from '../../../../src/presentation/http/controllers/auth.controller.js';
import { errorHandler } from '../../../../src/presentation/http/middlewares/error-handler.middleware.js';

function createApp(authProvider: AuthProvider, isProduction = false) {
  const app = express();
  app.use(express.json());
  app.post('/login', createLoginController(new LoginUseCase(authProvider), isProduction));
  app.use(errorHandler);
  return app;
}

describe('createLoginController', () => {
  it('returns the session and sets an HttpOnly cookie', async () => {
    const authProvider: AuthProvider = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'jwt-token',
        expiresIn: 3600,
        user: {
          id: 'user-id',
          email: 'jane@example.com',
          name: 'Jane Doe',
          role: 'USER',
        },
      }),
      verifyAccessToken: jest.fn(),
    };

    const response = await request(createApp(authProvider))
      .post('/login')
      .send({ email: 'jane@example.com', password: 'Demo123' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      access_token: 'jwt-token',
      expires_in: 3600,
      user: {
        id: 'user-id',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'USER',
      },
    });
    expect(response.headers['set-cookie']?.[0]).toContain('access_token=jwt-token');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Strict');
  });

  it('returns only 401 when authentication fails', async () => {
    const authProvider: AuthProvider = {
      login: jest.fn().mockRejectedValue(new UnauthorizedError()),
      verifyAccessToken: jest.fn(),
    };

    const response = await request(createApp(authProvider))
      .post('/login')
      .send({ email: 'jane@example.com', password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.text).toBe('');
  });
});
