export const APP_TIME_ZONE = "America/Denver";

export function todayInDenver(): string {
  return dateToDenverString(new Date());
}

export function dateToDenverString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function addWeeks(dateString: string, weeks: number): string {
  return addDays(dateString, weeks * 7);
}

export function formatFriendlyDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function getMondayWeekStart(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return addDays(dateString, -daysSinceMonday);
}

export function getRecentDates(count: number, endDate = todayInDenver()): string[] {
  return Array.from({ length: count }, (_, index) => addDays(endDate, index - count + 1));
}

export function getRecentWeekStarts(count: number, endDate = todayInDenver()): string[] {
  const currentWeek = getMondayWeekStart(endDate);
  return Array.from({ length: count }, (_, index) => addWeeks(currentWeek, index - count + 1));
}
