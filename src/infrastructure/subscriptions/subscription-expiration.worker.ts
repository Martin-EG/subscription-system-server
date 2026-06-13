import type { ExpireDueSubscriptionsResult } from '../../application/ports';

interface ExpireSubscriptions {
  execute(): Promise<ExpireDueSubscriptionsResult>;
}

interface SubscriptionExpirationWorkerOptions {
  pollIntervalMs: number;
  onError?: (error: unknown) => void;
}

export class SubscriptionExpirationWorker {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = true;

  constructor(
    private readonly expireSubscriptions: ExpireSubscriptions,
    private readonly options: SubscriptionExpirationWorkerOptions,
  ) {}

  start(): void {
    if (!this.stopped) {
      return;
    }

    this.stopped = false;
    void this.run();
  }

  async stop(): Promise<void> {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private async run(): Promise<void> {
    if (this.stopped || this.running) {
      return;
    }

    this.running = true;
    let nextPollIntervalMs = this.options.pollIntervalMs;

    try {
      const result = await this.expireSubscriptions.execute();

      if (result.expiredSubscriptions > 0) {
        nextPollIntervalMs = 0;
      }
    } catch (error) {
      this.options.onError?.(error);
    } finally {
      this.running = false;
    }

    if (!this.stopped) {
      this.timer = setTimeout(() => void this.run(), nextPollIntervalMs);
    }
  }
}
