import { PaymentNotificationWorker } from '../../../src/infrastructure/messaging/payment-notification.worker';

describe('PaymentNotificationWorker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('executes immediately and continues polling until stopped', async () => {
    const execute = jest.fn().mockResolvedValue({
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    const worker = new PaymentNotificationWorker(
      { execute },
      {
        pollIntervalMs: 1000,
      },
    );

    worker.start();
    await Promise.resolve();

    expect(execute).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1000);

    expect(execute).toHaveBeenCalledTimes(2);
    await worker.stop();

    await jest.advanceTimersByTimeAsync(2000);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('reports an execution error and keeps polling', async () => {
    const error = new Error('database unavailable');
    const execute = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ claimed: 0, sent: 0, failed: 0 });
    const onError = jest.fn();
    const worker = new PaymentNotificationWorker(
      { execute },
      {
        pollIntervalMs: 1000,
        onError,
      },
    );

    worker.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(error);

    await jest.advanceTimersByTimeAsync(1000);
    expect(execute).toHaveBeenCalledTimes(2);
    await worker.stop();
  });

  it('ignores duplicate start calls', async () => {
    const execute = jest.fn().mockResolvedValue({
      claimed: 0,
      sent: 0,
      failed: 0,
    });
    const worker = new PaymentNotificationWorker(
      { execute },
      {
        pollIntervalMs: 1000,
      },
    );

    worker.start();
    worker.start();
    await Promise.resolve();

    expect(execute).toHaveBeenCalledTimes(1);
    await worker.stop();
  });
});
