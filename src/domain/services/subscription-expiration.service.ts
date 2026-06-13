import type { BillingPeriod } from "../entities";

type CalculateSubscriptionExpiration = (startedAt: Date, billingPeriod: BillingPeriod | null) => Date | null;
export const calculateSubscriptionExpiration: CalculateSubscriptionExpiration = (startedAt, billingPeriod) => {
  if(billingPeriod === null) {
    return null;
  }

  const year = startedAt.getUTCFullYear();
  const month = startedAt.getUTCMonth();
  const day = startedAt.getUTCDate();

  if(billingPeriod === 'YEARLY') {
    const isLeapYear = startedAt.getUTCMonth() === 1 && startedAt.getUTCDate() === 29;
    const dayOfNextYear = isLeapYear ? 28 : startedAt.getUTCDate();

    return new Date(
      Date.UTC(
        year + 1,
        month,
        dayOfNextYear,
        startedAt.getUTCHours(),
        startedAt.getUTCMinutes(),
        startedAt.getUTCSeconds(),
        startedAt.getUTCMilliseconds(),
      )
    );
  }

  const lastDayOfNexTMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      year,
      month + 1,
      Math.min(day, lastDayOfNexTMonth),
      startedAt.getUTCHours(),
      startedAt.getUTCMinutes(),
      startedAt.getUTCSeconds(),
      startedAt.getUTCMilliseconds(),
    )
  );
}