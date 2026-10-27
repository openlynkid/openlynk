import type { BillingInterval } from "./types";

/**
 * Checks if a given year is a leap year in the Gregorian calendar.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the number of days in a given month (0-indexed: 0 = Jan, 11 = Dec) in UTC.
 */
export function getDaysInUTCMonth(year: number, month: number): number {
  // Day 0 of the next month returns the last day of the current month in UTC
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Deterministically calculates the next period end date based on a start date and interval.
 * Clamps month-end dates (e.g. Jan 31 + 1 month -> Feb 28 or Feb 29 in leap year),
 * handles Feb 29 leap year + 1 year -> Feb 28, and preserves time components in UTC.
 */
export function calculatePeriodEnd(startDate: Date, interval: BillingInterval): Date {
  const startMs = startDate.getTime();
  if (isNaN(startMs)) {
    throw new Error(`Invalid start date passed to calculatePeriodEnd: ${startDate}`);
  }

  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();
  const day = startDate.getUTCDate();
  const hours = startDate.getUTCHours();
  const minutes = startDate.getUTCMinutes();
  const seconds = startDate.getUTCSeconds();
  const milliseconds = startDate.getUTCMilliseconds();

  if (interval === "monthly") {
    const targetYear = month === 11 ? year + 1 : year;
    const targetMonth = month === 11 ? 0 : month + 1;
    const maxDays = getDaysInUTCMonth(targetYear, targetMonth);
    const targetDay = Math.min(day, maxDays);
    return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, milliseconds));
  }

  if (interval === "yearly") {
    const targetYear = year + 1;
    const targetMonth = month;
    const maxDays = getDaysInUTCMonth(targetYear, targetMonth);
    const targetDay = Math.min(day, maxDays);
    return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, milliseconds));
  }

  if (interval === "lifetime") {
    // 100 years perpetual period end
    const targetYear = year + 100;
    const targetMonth = month;
    const maxDays = getDaysInUTCMonth(targetYear, targetMonth);
    const targetDay = Math.min(day, maxDays);
    return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, milliseconds));
  }

  throw new Error(`Unsupported billing interval: ${interval}`);
}
