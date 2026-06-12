import type { AuthProvider } from '../../../src/application/ports/auth-provider.port.js';
import { LoginUseCase } from '../../../src/application/use-cases/login.use-case.js';

describe('LoginUseCase', () => {
  it('delegates authentication to the provider', async () => {
    const loginResult = {
      accessToken: 'jwt-token',
      expiresIn: 3600,
      user: {
        id: 'user-id',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'USER',
      },
    };
    const login = jest.fn().mockResolvedValue(loginResult);
    const authProvider: AuthProvider = {
      login,
      verifyAccessToken: jest.fn(),
    };
    const useCase = new LoginUseCase(authProvider);

    await expect(
      useCase.execute({ email: 'jane@example.com', password: 'Demo123' }),
    ).resolves.toEqual(loginResult);
    expect(login).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'Demo123',
    });
  });
});
