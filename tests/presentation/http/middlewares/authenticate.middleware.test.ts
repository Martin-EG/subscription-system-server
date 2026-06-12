import express from 'express';
import request from 'supertest';
import type { AuthProvider } from '../../../../src/application/ports/auth-provider.port.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';
import { authenticate } from '../../../../src/presentation/http/middlewares/authenticate.middleware.js';

function createApp(authProvider: AuthProvider) {
  const app = express();
  app.get('/protected', authenticate(authProvider), (_request, response) => {
    response.status(200).json(response.locals.authUser);
  });
  return app;
}

describe('authenticate', () => {
  it('stores the verified user and continues', async () => {
    const user = {
      id: 'user-id',
      email: 'jane@example.com',
      name: 'Jane Doe',
      role: 'USER',
    };
    const verifyAccessToken = jest.fn().mockResolvedValue(user);
    const authProvider: AuthProvider = {
      login: jest.fn(),
      verifyAccessToken,
    };

    const response = await request(createApp(authProvider))
      .get('/protected')
      .set('Authorization', 'Bearer jwt-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(user);
    expect(verifyAccessToken).toHaveBeenCalledWith('jwt-token');
  });

  it('returns an empty 401 response when the bearer token is missing', async () => {
    const authProvider: AuthProvider = {
      login: jest.fn(),
      verifyAccessToken: jest.fn(),
    };

    const response = await request(createApp(authProvider)).get('/protected');

    expect(response.status).toBe(401);
    expect(response.text).toBe('');
  });

  it('returns an empty 401 response when token verification fails', async () => {
    const authProvider: AuthProvider = {
      login: jest.fn(),
      verifyAccessToken: jest.fn().mockRejectedValue(new UnauthorizedError()),
    };

    const response = await request(createApp(authProvider))
      .get('/protected')
      .set('Authorization', 'Bearer invalid');

    expect(response.status).toBe(401);
    expect(response.text).toBe('');
  });
});
