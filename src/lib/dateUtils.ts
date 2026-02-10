import { formatInTimeZone } from "date-fns-tz";

export const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Returns the current date in Jakarta timezone as a Date object.
 * This effectively shifts the system time to Jakarta time.
 */
export function getJakartaDate(): Date {
    const now = new Date();
    const jakartaTimeStr = now.toLocaleString("en-US", { timeZone: JAKARTA_TIMEZONE });
    return new Date(jakartaTimeStr);
}

/**
 * Returns the ISO string for the start of the day in Jakarta Timezone, 
 * converted to UTC for database querying.
 * Example: Input 2024-02-10 -> Output 2024-02-09T17:00:00.000Z (if Offset is +7)
 */
export function getJakartaStartOfDayISO(date: Date = new Date()): string {
    // 1. Format the date string as YYYY-MM-DD in Jakarta
    const dateStr = formatInTimeZone(date, JAKARTA_TIMEZONE, "yyyy-MM-dd");
    // 2. Create a date object from that string, assuming it is Jakarta time
    // We construct the string explicitly to start at 00:00:00 Jakarta time
    // Then we let Date object parse it, but we need to ensure we handle the offset correct.
    // Easier approach: Use formatInTimeZone to get the string, then append T00:00:00+07:00

    return `${dateStr}T00:00:00.000+07:00`;
}

export function getJakartaEndOfDayISO(date: Date = new Date()): string {
    const dateStr = formatInTimeZone(date, JAKARTA_TIMEZONE, "yyyy-MM-dd");
    return `${dateStr}T23:59:59.999+07:00`;
}

/**
 * Display helper
 */
export function formatJakartaDate(date: Date, formatStr: string = "dd MMMM yyyy"): string {
    return formatInTimeZone(date, JAKARTA_TIMEZONE, formatStr);
}
