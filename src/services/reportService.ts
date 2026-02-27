import { generateAttendanceExcel, EmployeeSummary, AttendanceRecord } from '@/lib/excelExport';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export class ReportService {
    /**
     * Mengambil dan memproses data dalam jumlah besar dan mendownloadnya
     * Menghindari N+1 query dengan memakai JOIN.
     */
    static async exportMonthlyAttendance(startDateIso: string, endDateIso: string, periodName: string) {
        // Prepare correct date boundaries (make sure end date covers the whole day)
        const startBoundary = `${startDateIso}T00:00:00.000Z`;
        const endBoundary = `${endDateIso}T23:59:59.999Z`;

        // 1. Fetch Data (Tanpa JOIN Supabase untuk menghindari Schema Cache Error)
        const { data: records, error } = await supabase
            .from('attendance')
            .select(`
        id,
        user_id,
        clock_in,
        clock_out,
        status,
        clock_in_location
      `)
            .gte('clock_in', startBoundary)
            .lte('clock_in', endBoundary)
            .order('clock_in', { ascending: true });

        if (error) {
            console.error("Error fetching attendance records:", error);
            throw new Error(error.message);
        }

        // Fetch Profiles separately
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, full_name, department');

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            throw new Error(profilesError.message);
        }

        const profileMap = new Map();
        profiles?.forEach(p => {
            profileMap.set(p.user_id, {
                full_name: p.full_name,
                department: p.department
            });
        });

        // 2. Data Transformation O(n) (Satu kali loop)
        const summaryMap = new Map<string, EmployeeSummary>();
        const detailsMap: AttendanceRecord[] = [];

        records.forEach(req => {
            const profile = profileMap.get(req.user_id);
            const empName = profile?.full_name || 'Unknown';
            const dept = profile?.department || '-';

            // Default shift as it's not strictly queried unless via explicit schedule mapping
            const shiftName = 'Reguler 08:00 - 17:00';

            // --- Siapkan Transformasi Data Harian ---
            let clockInStr = '-';
            let clockOutStr = null;
            let dateStr = '-';

            // Parse clock_in which is a full ISO timestamp
            if (req.clock_in) {
                const clockInDate = new Date(req.clock_in);
                clockInStr = format(clockInDate, 'HH:mm');
                dateStr = format(clockInDate, 'dd-MM-yyyy');
            }

            // Parse clock_out
            if (req.clock_out) {
                const clockOutDate = new Date(req.clock_out);
                clockOutStr = format(clockOutDate, 'HH:mm');
            }

            let finalStatus: 'Hadir' | 'Terlambat' | 'Alpha' | 'Cuti' = 'Hadir';
            if (req.status === 'late') finalStatus = 'Terlambat';
            else if (req.status === 'absent' || req.status === 'alpha') finalStatus = 'Alpha';
            else if (req.status === 'leave' || req.status === 'sick' || req.status === 'permission') finalStatus = 'Cuti';
            else if (req.status === 'early_leave') finalStatus = 'Hadir'; // Bekerja tapi pulang cepat
            else if (req.status === 'present') finalStatus = 'Hadir';

            // Extract & Compute manually since DB doesn't have these columns natively
            let workHours = 0;
            let lateMins = 0;
            const earlyMins = 0;
            const otMins = 0;
            const deviceName = (req.clock_in_location && req.clock_in_location.length > 5) ? 'Mobile / Web' : 'Web';

            if (req.clock_in) {
                const clockInDate = new Date(req.clock_in);
                const [targetH, targetM] = [8, 0]; // 08:00
                // Calculate Late Minutes
                const targetTime = new Date(clockInDate);
                targetTime.setHours(targetH, targetM, 0, 0);

                if (clockInDate > targetTime) {
                    lateMins = Math.floor((clockInDate.getTime() - targetTime.getTime()) / 60000);
                }

                // Calculate Work Hours if clocked out
                if (req.clock_out) {
                    const start = clockInDate.getTime();
                    const end = new Date(req.clock_out).getTime();
                    workHours = (end - start) / (1000 * 60 * 60); // in hours
                }
            }

            detailsMap.push({
                employeeName: empName,
                department: dept,
                date: dateStr,
                clockIn: clockInStr,
                clockOut: clockOutStr,
                shift: shiftName,
                status: finalStatus,
                totalWorkHours: workHours,
                totalLateMins: lateMins,
                earlyLeaveMins: earlyMins,
                overtimeMins: otMins,
                device: deviceName
            });

            // --- Accumulate Summary ---
            if (!summaryMap.has(empName)) {
                summaryMap.set(empName, {
                    employeeName: empName,
                    department: dept,
                    totalPresent: 0, totalLate: 0, totalAbsent: 0, totalLeave: 0,
                    totalMonthlyWorkHours: 0, totalMonthlyOvertimeMins: 0
                });
            }

            const summary = summaryMap.get(empName)!;
            if (finalStatus === 'Hadir') summary.totalPresent++;
            else if (finalStatus === 'Terlambat') summary.totalLate++;
            else if (finalStatus === 'Alpha') summary.totalAbsent++;
            else if (finalStatus === 'Cuti') summary.totalLeave++;

            summary.totalMonthlyWorkHours += workHours;
            summary.totalMonthlyOvertimeMins += otMins;
        });

        // 3. Inject ke File Excel
        await generateAttendanceExcel({
            month: periodName,
            summaries: Array.from(summaryMap.values()),
            details: detailsMap
        });
    }
}
