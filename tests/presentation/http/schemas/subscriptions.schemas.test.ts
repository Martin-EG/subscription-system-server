import { paginationSchema } from '../../../../src/presentation/http/schemas/subscriptions.schemas';

describe('paginationSchema', () => {
  it('applies pagination defaults', () => {
    expect(paginationSchema.parse({})).toEqual({
      page: 1,
      limit: 10,
    });
  });

  it('coerces valid query string values', () => {
    expect(paginationSchema.parse({ page: '2', limit: '50' })).toEqual({
      page: 2,
      limit: 50,
    });
  });

  it.each([
    { page: '0', limit: '20' },
    { page: '1', limit: '0' },
    { page: '1', limit: '101' },
    { page: 'invalid', limit: '20' },
  ])('rejects invalid pagination: %p', (query) => {
    expect(paginationSchema.safeParse(query).success).toBe(false);
  });
});
