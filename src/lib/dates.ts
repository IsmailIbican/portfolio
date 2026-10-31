/** "2023-06" -> first day of that month, UTC. */
export function parseMonth(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1));
}

/** Date -> "2023-06" for <input type="month">. */
export function toMonthInput(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 7) : "";
}

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatRange(start: Date, end: Date | null): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "Present"}`;
}
