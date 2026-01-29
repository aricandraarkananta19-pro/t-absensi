/**
 * T-Absensi Date/Time Utilities
 * 
 * Centralized timezone handling for Jakarta (WIB/GMT+7)
 * All date operations should use these utilities for consistency
 */

// Jakarta timezone identifier
export const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Convert any Date to Jakarta date string (YYYY-MM-DD)
 */
export const toJakartaDate = (date: Date): string => {
    return date.toLocaleDateString("en-CA", { timeZone: JAKARTA_TIMEZONE });
};

/**
 * Convert any Date to Jakarta time string (HH:MM)
 */
export const toJakartaTime = (date: Date): string => {
    return date.toLocaleTimeString("id-ID", {
        timeZone: JAKARTA_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
    });
};

/**
 * Convert any Date to Jakarta time with seconds (HH:MM:SS)
 */
export const toJakartaTimeWithSeconds = (date: Date): string => {
    return date.toLocaleTimeString("id-ID", {
        timeZone: JAKARTA_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

/**
 * Get full Jakarta datetime string
 */
export const toJakartaDateTime = (date: Date): string => {
    return date.toLocaleString("id-ID", {
        timeZone: JAKARTA_TIMEZONE,
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

/**
 * Get Jakarta day of week
 */
export const getJakartaDayOfWeek = (date: Date): string => {
    return date.toLocaleDateString("id-ID", {
        timeZone: JAKARTA_TIMEZONE,
        weekday: "long",
    });
};

/**
 * Get full Jakarta date with weekday
 */
export const toJakartaFullDate = (date: Date): string => {
    return date.toLocaleDateString("id-ID", {
        timeZone: JAKARTA_TIMEZONE,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

/**
 * Get short Jakarta date (e.g., "Sen, 29 Jan")
 */
export const toJakartaShortDate = (date: Date): string => {
    return date.toLocaleDateString("id-ID", {
        timeZone: JAKARTA_TIMEZONE,
        weekday: "short",
        day: "numeric",
        month: "short",
    });
};

/**
 * Get current Jakarta time as Date object
 * Note: This returns a Date but you should use toJakarta* functions to display it
 */
export const getJakartaNow = (): Date => {
    return new Date();
};

/**
 * Parse a date string and return start of day in Jakarta timezone (as ISO string)
 * Useful for filtering records
 */
export const getJakartaStartOfDay = (dateString: string): string => {
    return `${dateString}T00:00:00+07:00`;
};

/**
 * Parse a date string and return end of day in Jakarta timezone (as ISO string)
 * Useful for filtering records
 */
export const getJakartaEndOfDay = (dateString: string): string => {
    return `${dateString}T23:59:59+07:00`;
};

/**
 * Check if a date is today in Jakarta timezone
 */
export const isJakartaToday = (date: Date): boolean => {
    const todayJakarta = toJakartaDate(new Date());
    const checkDateJakarta = toJakartaDate(date);
    return todayJakarta === checkDateJakarta;
};

/**
 * Get minutes since midnight in Jakarta timezone
 * Useful for time threshold comparisons
 */
export const getJakartaMinutesSinceMidnight = (date: Date): number => {
    const jakartaTimeStr = date.toLocaleTimeString("en-US", {
        timeZone: JAKARTA_TIMEZONE,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
    });
    const [hours, minutes] = jakartaTimeStr.split(":").map(Number);
    return hours * 60 + minutes;
};

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
};

/**
 * Calculate duration between two dates in hours and minutes
 */
export const calculateDuration = (
    start: Date,
    end: Date
): { hours: number; minutes: number; formatted: string } => {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
        hours,
        minutes,
        formatted: `${hours}j ${minutes}m`,
    };
};

/**
 * Format ISO date string to Jakarta display format
 */
export const formatISOToJakarta = (isoString: string): string => {
    return toJakartaDateTime(new Date(isoString));
};

/**
 * Format ISO date string to Jakarta time only
 */
export const formatISOToJakartaTime = (isoString: string): string => {
    return toJakartaTime(new Date(isoString));
};

/**
 * Format ISO date string to Jakarta date only
 */
export const formatISOToJakartaDate = (isoString: string): string => {
    return toJakartaFullDate(new Date(isoString));
};
