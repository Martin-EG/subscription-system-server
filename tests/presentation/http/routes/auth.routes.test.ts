import express from 'express';
import request from 'supertest';
import type { AuthProvider } from '../../../../src/application/ports/auth-provider.port.js';
import { errorHandler } from '../../../../src/presentation/http/middlewares/error-handler.middleware.js';
import { createAuthRouter } from '../../../../src/presentation/http/routes/auth.routes.js';

describe('createAuthRouter', () => {
  it('registers POST /login with validation and authentication', async () => {
    const login = jest.fn().mockResolvedValue({
      accessToken: 'jwt-token',
      expiresIn: 3600,
      user: {
        id: 'user-id',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'USER',
      },
    });
    const authProvider: AuthProvider = {
      login,
      verifyAccessToken: jest.fn(),
    };
    const app = express();
    app.use(express.json());
    app.use('/auth', createAuthRouter({ authProvider, isProduction: false }));
    app.use(errorHandler);

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'jane@example.com', password: 'Demo123' });

    expect(response.status).toBe(200);
    expect(login).toHaveBeenCalledTimes(1);
  });
});
