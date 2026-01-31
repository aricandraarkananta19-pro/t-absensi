import { addDays, format, isWithinInterval, parseISO } from "date-fns";
import { id } from "date-fns/locale";

export interface DailyAttendanceStatus {
    date: string; // YYYY-MM-DD
    formattedDate: string;
    dayName: string;
    status: 'present' | 'late' | 'early_leave' | 'absent' | 'leave' | 'permission' | 'alpha' | 'holiday' | 'future' | 'weekend';
    clockIn: string | null;
    clockOut: string | null;
    recordId: string | null;
    notes: string | null;
    isWeekend: boolean;
}

export interface LeaveRecord {
    start_date: string;
    end_date: string;
    leave_type: string;
    status: string; // 'approved'
}

/**
 * Generates a complete list of daily attendance statuses for a given period.
 * Automatically fills in missing dates with 'absent', 'weekend', 'future', or 'leave' statuses.
 * USES ASIA/JAKARTA TIMEZONE for comparison.
 */
export const generateAttendancePeriod = (
    startDate: Date,
    endDate: Date,
    records: any[],
    leaves: LeaveRecord[] = [],
    joinDate?: string | Date
): DailyAttendanceStatus[] => {
    const normalized: DailyAttendanceStatus[] = [];

    // Get Today in Jakarta YYYY-MM-DD to strictly determine "Future" vs "Past"
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    // Normalize Join Date
    let joinDateStr = '';
    if (joinDate) {
        // If it's a string, assume it's ISO or YYYY-MM-DD. If Date, format it.
        // Created_at is usually ISO string "2024-01-01T..."
        const d = new Date(joinDate);
        if (!isNaN(d.getTime())) {
            joinDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        }
    }

    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (currentDate <= end) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

        // Check pre-employment
        if (joinDateStr && dateStr < joinDateStr) {
            normalized.push({
                date: dateStr,
                formattedDate: format(currentDate, 'd MMMM yyyy', { locale: id }),
                dayName: format(currentDate, 'EEEE', { locale: id }),
                status: 'future', // Use 'future' to signify N/A / Pre-join
                clockIn: null,
                clockOut: null,
                recordId: null,
                notes: 'Belum Bergabung',
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6
            });
            currentDate = addDays(currentDate, 1);
            continue;
        }

        // 1. Find existing attendance record
        // Normalize DB timestamp to Jakarta Date String (YYYY-MM-DD)
        const record = records.find(r => {
            if (!r.clock_in) return false;
            const recordDateJakarta = new Date(r.clock_in).toLocaleDateString('en-CA', {
                timeZone: 'Asia/Jakarta'
            });
            return recordDateJakarta === dateStr;
        });

        // 2. Find Approved Leave
        // Check if dateStr is within any leave range
        const leave = leaves.find(l => {
            if (l.status !== 'approved') return false;
            return dateStr >= l.start_date && dateStr <= l.end_date;
        });

        let status: DailyAttendanceStatus['status'] = 'absent';
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // --- STATUS DETERMINATION LOGIC ---

        if (record) {
            status = (record.status as any) || 'present';
        } else if (leave) {
            status = 'leave';
        } else {
            // Comparison: dateStr vs todayStr
            if (dateStr > todayStr) {
                status = 'future';
            } else if (dateStr === todayStr) {
                // Today with no record yet -> Pending (Display as Future to avoid premature Absent)
                status = 'future';
            } else if (isWeekend) {
                status = 'weekend';
            } else {
                // Past day (strictly < today), no record, not qualified leave, not weekend -> ABSENT
                status = 'absent';
            }
        }

        normalized.push({
            date: dateStr,
            formattedDate: format(currentDate, 'd MMMM yyyy', { locale: id }),
            dayName: format(currentDate, 'EEEE', { locale: id }),
            status,
            clockIn: record?.clock_in || null,
            clockOut: record?.clock_out || null,
            recordId: record?.id || null,
            notes: record?.notes || (leave ? `Cuti: ${leave.leave_type}` : null),
            isWeekend
        });

        currentDate = addDays(currentDate, 1);
    }

    return normalized;
};
