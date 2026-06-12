import { loginBodySchema } from '../../../../src/presentation/http/schemas/auth.schemas.js';

describe('loginBodySchema', () => {
  it('accepts an email and non-empty password', () => {
    expect(
      loginBodySchema.safeParse({
        email: 'jane@example.com',
        password: 'Demo123',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid or additional fields', () => {
    expect(
      loginBodySchema.safeParse({
        email: 'invalid-email',
        password: '',
        extra: true,
      }).success,
    ).toBe(false);
  });
});
