import { createCheckoutRequestHash } from '../../../src/domain/services';

describe('createCheckoutRequestHash', () => {
  it('creates the expected SHA-256 hash for the checkout request', () => {
    const result = createCheckoutRequestHash({
      planId: 'plan-monthly',
      paymentMethod: 'card',
    });

    expect(result).toBe('0a04477e48029ce4184b025626f4cc824555ce9f26fbbd01f5d1f223953ff810');
  });

  it('returns the same hash for the same checkout request', () => {
    const input = {
      planId: 'plan-yearly',
      paymentMethod: 'card',
    };

    expect(createCheckoutRequestHash(input)).toBe(createCheckoutRequestHash(input));
  });

  it('returns a different hash when the plan changes', () => {
    const monthlyHash = createCheckoutRequestHash({
      planId: 'plan-monthly',
      paymentMethod: 'card',
    });
    const yearlyHash = createCheckoutRequestHash({
      planId: 'plan-yearly',
      paymentMethod: 'card',
    });

    expect(monthlyHash).not.toBe(yearlyHash);
  });

  it('returns a different hash when the payment method changes', () => {
    const cardHash = createCheckoutRequestHash({
      planId: 'plan-monthly',
      paymentMethod: 'card',
    });
    const bankTransferHash = createCheckoutRequestHash({
      planId: 'plan-monthly',
      paymentMethod: 'bank-transfer',
    });

    expect(cardHash).not.toBe(bankTransferHash);
  });
});
