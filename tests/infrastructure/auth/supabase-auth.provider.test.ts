import { UnauthorizedError } from '../../../src/domain/errors/unauthorized.error.js';
import { SupabaseAuthProvider } from '../../../src/infrastructure/auth/supabase-auth.provider.js';

function createClient(auth: Record<string, jest.Mock>) {
  return { auth } as never;
}

describe('SupabaseAuthProvider', () => {
  it('maps a successful Supabase session', async () => {
    const signInWithPassword = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'jwt-token',
          expires_in: 3600,
        },
        user: {
          id: 'user-id',
          email: 'jane@example.com',
          user_metadata: { name: 'Jane Doe' },
          app_metadata: { app_role: 'USER' },
        },
      },
      error: null,
    });
    const provider = new SupabaseAuthProvider(
      createClient({ signInWithPassword, getUser: jest.fn() }),
    );

    await expect(
      provider.login({ email: 'jane@example.com', password: 'Demo123' }),
    ).resolves.toEqual({
      accessToken: 'jwt-token',
      expiresIn: 3600,
      user: {
        id: 'user-id',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'USER',
      },
    });
  });

  it('returns unauthorized when Supabase rejects the login', async () => {
    const provider = new SupabaseAuthProvider(
      createClient({
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error('Invalid credentials'),
        }),
        getUser: jest.fn(),
      }),
    );

    await expect(
      provider.login({ email: 'jane@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('verifies and maps an access token', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-id',
          email: 'admin@example.com',
          user_metadata: { name: 'John Doe' },
          app_metadata: { app_role: 'ADMIN' },
        },
      },
      error: null,
    });
    const provider = new SupabaseAuthProvider(
      createClient({ signInWithPassword: jest.fn(), getUser }),
    );

    await expect(provider.verifyAccessToken('jwt-token')).resolves.toEqual({
      id: 'user-id',
      email: 'admin@example.com',
      name: 'John Doe',
      role: 'ADMIN',
    });
    expect(getUser).toHaveBeenCalledWith('jwt-token');
  });
});
