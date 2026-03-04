import { format } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Returns the current period_month based on today's date
 * Auto-resets on the 1st of the month (YYYY-MM format)
 */
export const getCurrentPeriodMonth = (): string => {
    return format(new Date(), 'yyyy-MM');
};

/**
 * Formats a given date to a period_month string
 */
export const formatToPeriodMonth = (date: Date): string => {
    return format(date, 'yyyy-MM');
};

/**
 * Parses a period_month string back into a label like "Maret 2026"
 */
export const getPeriodLabel = (periodMonth: string): string => {
    try {
        if (!periodMonth || periodMonth === 'custom') return 'Custom Range';
        const [year, month] = periodMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return format(date, 'MMMM yyyy', { locale: id });
    } catch {
        return periodMonth;
    }
};
