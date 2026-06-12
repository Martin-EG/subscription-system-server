import { UnauthorizedError } from '../../../src/domain/errors/unauthorized.error.js';

describe('UnauthorizedError', () => {
  it('uses a stable name and message', () => {
    const error = new UnauthorizedError();

    expect(error.name).toBe('UnauthorizedError');
    expect(error.message).toBe('Unauthorized');
  });
});
