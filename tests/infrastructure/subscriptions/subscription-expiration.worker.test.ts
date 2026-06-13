import { SubscriptionExpirationWorker } from '../../../src/infrastructure/subscriptions/subscription-expiration.worker';

describe('SubscriptionExpirationWorker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('executes immediately and continues polling until stopped', async () => {
    const execute = jest.fn().mockResolvedValue({
      expiredSubscriptions: 0,
      revokedAccess: 0,
    });
    const worker = new SubscriptionExpirationWorker(
      { execute },
      {
        pollIntervalMs: 60_000,
      },
    );

    worker.start();
    await Promise.resolve();

    expect(execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(execute).toHaveBeenCalledTimes(2);
    await worker.stop();

    await jest.advanceTimersByTimeAsync(120_000);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('reports errors and keeps polling', async () => {
    const error = new Error('database unavailable');
    const execute = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ expiredSubscriptions: 0, revokedAccess: 0 });
    const onError = jest.fn();
    const worker = new SubscriptionExpirationWorker(
      { execute },
      {
        pollIntervalMs: 60_000,
        onError,
      },
    );

    worker.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(error);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(execute).toHaveBeenCalledTimes(2);
    await worker.stop();
  });

  it('immediately drains another batch when subscriptions were expired', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({
        expiredSubscriptions: 100,
        revokedAccess: 100,
      })
      .mockResolvedValue({
        expiredSubscriptions: 0,
        revokedAccess: 0,
      });
    const worker = new SubscriptionExpirationWorker(
      { execute },
      {
        pollIntervalMs: 60_000,
      },
    );

    worker.start();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(0);

    expect(execute).toHaveBeenCalledTimes(2);
    await worker.stop();
  });

  it('ignores duplicate start calls', async () => {
    const execute = jest.fn().mockResolvedValue({
      expiredSubscriptions: 0,
      revokedAccess: 0,
    });
    const worker = new SubscriptionExpirationWorker(
      { execute },
      {
        pollIntervalMs: 60_000,
      },
    );

    worker.start();
    worker.start();
    await Promise.resolve();

    expect(execute).toHaveBeenCalledTimes(1);
    await worker.stop();
  });
});
