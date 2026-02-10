import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getJakartaDate, getJakartaStartOfDayISO, getJakartaEndOfDayISO } from "@/lib/dateUtils";
import { formatInTimeZone } from "date-fns-tz";
import { startOfMonth, subMonths } from "date-fns";
import { ABSENSI_WAJIB_ROLE, EXCLUDED_USER_NAMES } from "@/lib/constants";

// Type definitions for dashboard data
export interface DashboardStats {
    totalEmployees: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    departments: number;
    pendingLeave: number;
    onTimeRate: number;
    newEmployeesThisMonth: number;
    approvedLeaveThisMonth: number;
    attendanceThisMonth: number;
    attendanceRate: number;
}

export interface LiveStats {
    clockedInToday: number;
    lateToday: number;
    lastClockIn: string | null;
    hasData: boolean;
}

export interface RealTimeEmployee {
    id: string;
    user_id: string;
    full_name: string;
    department?: string;
    clock_in: string;
    clock_out: string | null;
    status: string;
    liveStatus: "online" | "present" | "late" | "inactive" | "idle";
    shift: string;
}

export interface MonthlyTrendData {
    month: string;
    year: number;
    attendanceRate: number;
    onTimeRate: number;
    total: number;
    late: number;
}

export interface DepartmentData {
    name: string;
    count: number;
    color: string;
}

export interface JournalData {
    id: string;
    user_id: string;
    full_name: string;
    content: string;  // Note: DB uses 'content', not 'title'
    created_at: string;
    date: string;
    status: "pending" | "approved" | "rejected" | "submitted" | "draft" | "need_revision";
    avatar_url?: string;
    department?: string;
    duration?: number;
}

export interface RecentJournalsResult {
    journals: JournalData[];
    needsReminder: boolean;
    employeesNeedingJournals: number;
    todayJournalsCount: number;
}


// Fetch IDs of employees
export const useEmployeeIds = () => {
    return useQuery({
        queryKey: ["employeeIds"],
        queryFn: async () => {
            // 1. Get Candidate IDs from Roles
            const { data: karyawanRoles, error } = await supabase
                .from("user_roles")
                .select("user_id")
                .in("role", ABSENSI_WAJIB_ROLE);

            let candidateIds: string[] = [];

            if (error || !karyawanRoles || karyawanRoles.length === 0) {
                // Fallback: Get all from profiles
                const { data: profiles } = await supabase.from("profiles").select("user_id");
                candidateIds = profiles?.map(p => p.user_id) || [];
            } else {
                candidateIds = karyawanRoles.map(r => r.user_id);
            }

            if (candidateIds.length === 0) return new Set<string>();

            // 2. Fetch Profiles to Filter by Name (Exclude Specific Users)
            const { data: profiles } = await supabase
                .from("profiles")
                .select("user_id, full_name")
                .in("user_id", candidateIds);

            if (!profiles) return new Set(candidateIds);

            // 3. Filter Matches
            const validProfiles = profiles.filter(p => {
                if (!p.full_name) return true; // keep unknown names? or filter? keep safe.
                const nameLower = p.full_name.toLowerCase();
                // Check against blacklist
                return !EXCLUDED_USER_NAMES.some(excluded => nameLower.includes(excluded.toLowerCase()));
            });

            return new Set(validProfiles.map(p => p.user_id));
        },
        staleTime: 1000 * 60 * 30, // 30 mins (roles rarely change)
    });
};


// Fetch Dashboard Stats (Counters) - Now always enabled and fetches directly
export const useDashboardStats = (karyawanUserIds: Set<string> | undefined) => {
    return useQuery({
        queryKey: ["dashboardStats", Array.from(karyawanUserIds || []).length], // Refetch if count changes
        // Always enabled - don't depend on karyawanUserIds
        queryFn: async (): Promise<DashboardStats | null> => {

            const today = getJakartaDate();
            // Ensure strictly Jakarta Time range for today
            const startIso = getJakartaStartOfDayISO(today);
            const endIso = getJakartaEndOfDayISO(today);

            // For monthly stats
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

            // Fetch all data in parallel
            const [
                profilesResult,
                attendanceResult,
                pendingLeavesResult,
                departmentsResult,
                pendingJournalsResult,
                approvedLeavesResult,
                approvedLeavesTodayResult
            ] = await Promise.all([
                supabase.from("profiles").select("user_id, department, created_at, full_name"), // Added full_name
                supabase.from("attendance").select("user_id, status")
                    .gte("clock_in", startIso)
                    .lte("clock_in", endIso),
                supabase.from("leave_requests").select("id").eq("status", "pending"),
                supabase.from("profiles").select("department").not("department", "is", null),
                supabase.from("work_journals").select("id", { count: "exact", head: true })
                    .eq("verification_status", "pending"),
                supabase.from("leave_requests").select("id, user_id")
                    .eq("status", "approved")
                    .gte("start_date", startOfMonth.toISOString().split('T')[0])
                    .lte("end_date", endOfMonth.toISOString().split('T')[0]),
                // New: Fetch leaves active TODAY to exclude from absent count
                supabase.from("leave_requests").select("user_id")
                    .eq("status", "approved")
                    .lte("start_date", today.toISOString().split('T')[0])
                    .gte("end_date", today.toISOString().split('T')[0])
            ]);


            // If karyawanUserIds provided, filter; otherwise use all profiles (Approved Filter)
            let filterIds: Set<string>;

            if (karyawanUserIds && karyawanUserIds.size > 0) {
                filterIds = karyawanUserIds;
            } else {
                // Fallback: Filter profiles manually
                const validProfiles = profilesResult.data?.filter(p => {
                    if (!p.full_name) return true;
                    const nameLower = p.full_name.toLowerCase();
                    return !EXCLUDED_USER_NAMES.some(excluded => nameLower.includes(excluded.toLowerCase()));
                }) || [];
                filterIds = new Set(validProfiles.map(p => p.user_id));
            }

            const totalEmployees = filterIds.size > 0 ? filterIds.size : (profilesResult.data?.length || 0);

            // Filter attendance to relevant users (or use all if no filter)
            const relevantAttendance = attendanceResult.data?.filter(a =>
                filterIds.size === 0 || filterIds.has(a.user_id)
            ) || [];

            const present = relevantAttendance.length;
            const late = relevantAttendance.filter(a => a.status === "late").length;
            const onTime = present - late;

            // Calculate active leaves TODAY
            const relevantLeavesToday = approvedLeavesTodayResult.data?.filter(l =>
                filterIds.size === 0 || filterIds.has(l.user_id)
            ) || [];

            // Exclude those present OR on leave from "Absent"
            // Use a Set to track distinct users who are "Accounted For" (Present or Leave)
            const accountedForUserIds = new Set([
                ...relevantAttendance.map(a => a.user_id),
                ...relevantLeavesToday.map(l => l.user_id)
            ]);

            // Calculate absent: Total - Accounted For
            // We iterate over the *filtered* profiles (totalEmployees source)
            let absent = 0;
            if (profilesResult.data) {
                const targetProfiles = profilesResult.data.filter(p => filterIds.has(p.user_id));
                absent = targetProfiles.filter(p => !accountedForUserIds.has(p.user_id)).length;
            } else {
                absent = Math.max(0, totalEmployees - accountedForUserIds.size);
            }

            const onTimeRate = present > 0 ? Math.round((onTime / present) * 100) : 0;
            const uniqueDepartments = new Set(
                departmentsResult.data?.map(d => d.department).filter(Boolean)
            ).size;
            const pendingLeaves = pendingLeavesResult.data?.length || 0;
            const pendingJournals = pendingJournalsResult.count || 0;

            // Calculate new metrics with filtering
            const relevantApprovedLeaves = approvedLeavesResult.data?.filter(l =>
                filterIds.size === 0 || filterIds.has(l.user_id)
            ) || [];

            const relevantProfiles = profilesResult.data?.filter(p =>
                filterIds.size === 0 || filterIds.has(p.user_id)
            ) || [];

            const newEmployees = relevantProfiles.filter(p => {
                if (!p.created_at) return false;
                const created = new Date(p.created_at);
                return created >= startOfMonth && created <= endOfMonth;
            }).length || 0;

            // Calculate attendance this month (for "Kehadiran Bulan Ini" card)
            const { count: attendanceThisMonthCount } = await supabase
                .from("attendance")
                .select("id", { count: "exact", head: true })
                .gte("clock_in", startOfMonth.toISOString())
                .lte("clock_in", endOfMonth.toISOString());

            // Calculate Attendance Rate
            const workDaysThisMonth = getWorkingDaysInMonth(today);
            const expectedAttendance = totalEmployees * workDaysThisMonth;
            const attendanceRate = expectedAttendance > 0
                ? Math.round(((attendanceThisMonthCount || 0) / expectedAttendance) * 100)
                : 0;


            return {
                totalEmployees,
                presentToday: present,
                lateToday: late,
                absentToday: absent,
                departments: uniqueDepartments,
                pendingLeave: pendingLeaves + pendingJournals, // Combined pending items
                onTimeRate,
                newEmployeesThisMonth: newEmployees,
                approvedLeaveThisMonth: relevantApprovedLeaves.length,
                attendanceThisMonth: attendanceThisMonthCount || 0,
                attendanceRate: Math.min(100, attendanceRate)
            };
        },
        staleTime: 1000 * 60 * 5, // 5 mins (we rely on realtime subscription for updates)
        refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes as backup
    });
};



// Fetch Live Stats (Today)
export const useLiveStats = (karyawanUserIds: Set<string> | undefined) => {
    return useQuery({
        queryKey: ["liveStats", Array.from(karyawanUserIds || []).length],
        // Always enabled
        queryFn: async (): Promise<LiveStats> => {
            const today = getJakartaDate();
            const startIso = getJakartaStartOfDayISO(today);
            const endIso = getJakartaEndOfDayISO(today);

            const { data: todayAttendance } = await supabase
                .from("attendance")
                .select("user_id, status, clock_in")
                .gte("clock_in", startIso)
                .lte("clock_in", endIso)
                .order("clock_in", { ascending: false });

            // Use all attendance if no filter, otherwise filter
            const validData = karyawanUserIds && karyawanUserIds.size > 0
                ? todayAttendance?.filter(a => karyawanUserIds.has(a.user_id)) || []
                : todayAttendance || [];

            return {
                clockedInToday: validData.length,
                lateToday: validData.filter(a => a.status === "late").length,
                lastClockIn: validData[0]?.clock_in || null,
                hasData: validData.length > 0
            };
        },
        refetchInterval: 1000 * 60, // Refresh every 1 minute
    });
};

// Fetch Weekly Trend (Optimized)
export const useWeeklyTrend = (karyawanUserIds: Set<string> | undefined) => {
    return useQuery({
        queryKey: ["weeklyTrend", Array.from(karyawanUserIds || []).length],
        // Always enabled
        queryFn: async () => {

            const today = getJakartaDate();
            // End date is Yesterday
            const endDate = new Date(today);
            endDate.setDate(endDate.getDate() - 1);

            // Start date is 6 days before that (total 7 days)
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6);

            const startIso = getJakartaStartOfDayISO(startDate);
            const endIso = getJakartaEndOfDayISO(endDate);

            // Optimized: Single Query for Range
            const { data: rangeAttendance } = await supabase
                .from("attendance")
                .select("user_id, status, clock_in")
                .gte("clock_in", startIso)
                .lte("clock_in", endIso);

            // Process in JS
            const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
            const weekData = [];

            // Use all records if no filter, otherwise filter
            const validRecords = karyawanUserIds && karyawanUserIds.size > 0
                ? rangeAttendance?.filter(a => karyawanUserIds.has(a.user_id)) || []
                : rangeAttendance || [];


            // Loop through last 7 days to build the chart data
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD (approx UTC, but consistent if comparing same strings)
                // ideally we use jakarta date string

                // Better date string comparison for consistency
                // We need to match the day based on local jakarta time of the record

                const dayRecords = validRecords.filter(r => {
                    // Check if record falls on this day
                    return r.clock_in.startsWith(dateStr); // Simple efficient check if ISO matches
                });

                const hadir = dayRecords.filter(a => a.status === "present" || a.status === "late").length;
                const terlambat = dayRecords.filter(a => a.status === "late").length;

                weekData.push({
                    day: days[d.getDay()],
                    hadir,
                    terlambat
                });
            }

            return weekData;
        },
        staleTime: 1000 * 60 * 60, // 1 hour (historical data doesn't change much)
    });
};

// ============================================================================
// NEW HOOKS FOR DASHBOARD ACTIVATION
// ============================================================================

// Real-Time Monitoring - Live updates via Supabase Subscription
// Now returns ALL obligated employees with their status (Present, Late, Absent, Leave)
export const useRealTimeMonitoring = (karyawanUserIds: Set<string> | undefined) => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel('realtime-attendance-dashboard')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'attendance' },
                () => {
                    // Invalidate relevant queries to trigger refetch
                    queryClient.invalidateQueries({ queryKey: ["realTimeMonitoring"] });
                    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
                    queryClient.invalidateQueries({ queryKey: ["liveStats"] });
                    queryClient.invalidateQueries({ queryKey: ["weeklyTrend"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    return useQuery({
        queryKey: ["realTimeMonitoring", Array.from(karyawanUserIds || [])],
        // Always enabled
        queryFn: async () => {
            // STRICTLY MATCH useDashboardStats LOGIC (which works)
            const today = getJakartaDate();
            const startIso = getJakartaStartOfDayISO(today);
            const endIso = getJakartaEndOfDayISO(today);


            // 1. Fetch ALL Obligated Employees
            let targetProfiles = [];

            if (karyawanUserIds && karyawanUserIds.size > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("user_id, full_name, department")
                    .in("user_id", Array.from(karyawanUserIds));
                targetProfiles = profiles || [];
            } else {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("user_id, full_name, department");

                // Fallback Filter
                targetProfiles = (profiles || []).filter(p => {
                    if (!p.full_name) return true;
                    const nameLower = p.full_name.toLowerCase();
                    return !EXCLUDED_USER_NAMES.some(excluded => nameLower.includes(excluded.toLowerCase()));
                });
            }

            // 2. Fetch TODAY's Attendance
            // Removed .is("deleted_at", null) to match useDashboardStats exactly
            // REMOVED 'shift' from selection to prevent query errors if column doesn't exist
            const { data: attendance, error: attendanceError } = await supabase
                .from("attendance")
                .select("id, user_id, clock_in, clock_out, status")
                .gte("clock_in", startIso)
                .lte("clock_in", endIso);

            if (attendanceError) {
                console.error("[useRealTimeMonitoring] Attendance Fetch Error:", attendanceError);
            }

            // 3. Fetch TODAY's Leaves
            // Ensure we use the YYYY-MM-DD string from the Jakarta date object
            const todayDateStr = formatInTimeZone(today, 'Asia/Jakarta', 'yyyy-MM-dd');

            const { data: leaves } = await supabase
                .from("leave_requests")
                .select("user_id, leave_type")
                .eq("status", "approved")
                .lte("start_date", todayDateStr)
                .gte("end_date", todayDateStr);

            // 4. Merge Data
            const monitoringData = targetProfiles.map(profile => {
                const record = attendance?.find(a => a.user_id === profile.user_id);
                const leave = leaves?.find(l => l.user_id === profile.user_id);

                let status = "absent";
                let liveStatus: "online" | "present" | "late" | "inactive" | "idle" | "absent" | "leave" = "absent";

                if (record) {
                    status = record.status;
                    const clockOutTime = record.clock_out ? new Date(record.clock_out) : null;

                    if (clockOutTime) {
                        liveStatus = "inactive"; // Pulang
                    } else if (record.status === "late") {
                        liveStatus = "late"; // Terlambat
                    } else {
                        liveStatus = "present"; // Hadir
                    }
                } else if (leave) {
                    status = "leave";
                    liveStatus = "leave";
                }

                return {
                    id: record?.id || `missing-${profile.user_id}`,
                    user_id: profile.user_id,
                    full_name: profile.full_name || "Unknown",
                    department: profile.department,
                    clock_in: record?.clock_in || null,
                    clock_out: record?.clock_out || null,
                    status: status,
                    liveStatus: liveStatus,
                    shift: record?.shift || "08:00 - 17:00",
                    leaveType: leave?.leave_type
                };
            });

            // 5. Sort for "Recent Activity" view or General Monitoring
            return monitoringData.sort((a, b) => {
                if (a.clock_in && b.clock_in) {
                    return new Date(b.clock_in).getTime() - new Date(a.clock_in).getTime();
                }
                if (a.clock_in) return -1;
                if (b.clock_in) return 1;
                return 0;
            });
        },
        // Keep polling as backup, but less frequent
        refetchInterval: 1000 * 60 * 2, // 2 minute backup
    });
};

// 6-Month Attendance Trend - Monthly attendance percentages
export const useMonthlyTrend = (karyawanUserIds: Set<string> | undefined) => {
    return useQuery({
        queryKey: ["monthlyTrend", Array.from(karyawanUserIds || []).length],
        // Always enabled
        queryFn: async (): Promise<MonthlyTrendData[]> => {
            const today = getJakartaDate();
            const monthlyData: MonthlyTrendData[] = [];
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

            // First get all profiles to know total count
            const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");

            let validProfileIds = new Set<string>();

            if (karyawanUserIds && karyawanUserIds.size > 0) {
                validProfileIds = karyawanUserIds;
            } else {
                const filtered = profiles?.filter(p => {
                    if (!p.full_name) return true;
                    const nameLower = p.full_name.toLowerCase();
                    return !EXCLUDED_USER_NAMES.some(excluded => nameLower.includes(excluded.toLowerCase()));
                }) || [];
                validProfileIds = new Set(filtered.map(p => p.user_id));
            }

            const totalEmployees = validProfileIds.size > 0 ? validProfileIds.size : 1;

            // Get data for last 6 months
            for (let i = 5; i >= 0; i--) {
                const targetMonth = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
                const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

                const startIso = getJakartaStartOfDayISO(startOfMonth);
                const endIso = getJakartaEndOfDayISO(endOfMonth);

                const { data: monthAttendance } = await supabase
                    .from("attendance")
                    .select("user_id, status")
                    .gte("clock_in", startIso)
                    .lte("clock_in", endIso);

                // Use all records if no filter
                const validRecords = karyawanUserIds && karyawanUserIds.size > 0
                    ? monthAttendance?.filter(a => karyawanUserIds.has(a.user_id)) || []
                    : monthAttendance || [];

                // Calculate working days in month (Mon-Fri, excluding weekends)
                const workingDays = getWorkingDaysInMonth(targetMonth);
                const totalPossibleAttendance = totalEmployees * workingDays;


                const presentCount = validRecords.filter(a => a.status === "present" || a.status === "late").length;
                const lateCount = validRecords.filter(a => a.status === "late").length;

                const attendanceRate = totalPossibleAttendance > 0
                    ? Math.round((presentCount / totalPossibleAttendance) * 100)
                    : 0;
                const onTimeRate = presentCount > 0
                    ? Math.round(((presentCount - lateCount) / presentCount) * 100)
                    : 0;

                monthlyData.push({
                    month: monthNames[targetMonth.getMonth()],
                    year: targetMonth.getFullYear(),
                    attendanceRate,
                    onTimeRate,
                    total: presentCount,
                    late: lateCount
                });
            }

            return monthlyData;
        },
        staleTime: 1000 * 60 * 60 * 2, // 2 hours (monthly data changes slowly)
    });
};

// Department Distribution - Employee count per department
export const useDepartmentDistribution = (karyawanUserIds: Set<string> | undefined) => {
    return useQuery({
        queryKey: ["departmentDistribution", Array.from(karyawanUserIds || []).length], // Add dependency
        // Always enabled
        queryFn: async (): Promise<DepartmentData[]> => {
            const { data: profiles } = await supabase
                .from("profiles")
                .select("user_id, department")
                .not("department", "is", null);

            // Use all profiles if no filter
            const validProfiles = karyawanUserIds && karyawanUserIds.size > 0
                ? profiles?.filter(p => karyawanUserIds.has(p.user_id)) || []
                : profiles || [];


            // Count employees per department
            const deptCounts = new Map<string, number>();
            validProfiles.forEach(p => {
                const dept = p.department || "Tidak Ada Departemen";
                deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
            });

            // Convert to array and sort by count
            const distribution = Array.from(deptCounts.entries())
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);

            // Add colors for chart
            const DEPT_COLORS = [
                "#1A5BA8", "#00A0E3", "#7DC242", "#F59E0B", "#EF4444",
                "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1"
            ];

            return distribution.map((dept, index) => ({
                ...dept,
                color: DEPT_COLORS[index % DEPT_COLORS.length]
            }));
        },
        staleTime: 1000 * 60 * 30, // 30 minutes (department data rarely changes)
    });
};

// Recent Journals - 5 most recent work journals with 4PM notification check
export const useRecentJournals = (karyawanUserIds: Set<string> | undefined) => {
    return useQuery({
        queryKey: ["recentJournals"],
        // Always enabled
        queryFn: async (): Promise<RecentJournalsResult> => {
            const today = getJakartaDate();
            const startIso = getJakartaStartOfDayISO(today);
            const endIso = getJakartaEndOfDayISO(today);

            // Get recent journals - use 'content' not 'title'
            const { data: journals, error } = await supabase
                .from("work_journals")
                .select("id, user_id, content, created_at, verification_status, date, duration")
                .is("deleted_at", null)  // Exclude soft-deleted
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) {
                console.error("Error fetching journals:", error);
                return { journals: [], needsReminder: false, employeesNeedingJournals: 0, todayJournalsCount: 0 };
            }

            // Get profiles for names
            const userIds = [...new Set(journals?.map(j => j.user_id) || [])];

            const profileMap = new Map<string, { full_name: string, avatar_url?: string, department?: string }>();
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("user_id, full_name, avatar_url, department")
                    .in("user_id", userIds);

                profiles?.forEach(p => {
                    profileMap.set(p.user_id, {
                        full_name: p.full_name,
                        avatar_url: p.avatar_url,
                        department: p.department
                    });
                });
            }

            // Use all journals if no filter, otherwise filter
            const validJournals: JournalData[] = (karyawanUserIds && karyawanUserIds.size > 0
                ? journals?.filter(j => karyawanUserIds.has(j.user_id))
                : journals)
                ?.slice(0, 5)
                .map(j => {
                    const profile = profileMap.get(j.user_id);
                    return {
                        id: j.id,
                        user_id: j.user_id,
                        full_name: profile?.full_name || "Unknown",
                        avatar_url: profile?.avatar_url,
                        department: profile?.department,
                        content: j.content || "No Content",
                        created_at: j.created_at,
                        date: j.date,
                        status: j.verification_status as JournalData["status"],
                        duration: j.duration
                    };
                }) || [];

            // Check if it's after 4PM and journals are missing for today
            const now = getJakartaDate();
            const hour = now.getHours();
            const needsReminder = hour >= 16; // After 4PM Jakarta time

            // Get today's journals count
            const { count: todayJournalsCount } = await supabase
                .from("work_journals")
                .select("id", { count: "exact", head: true })
                .gte("created_at", startIso)
                .lte("created_at", endIso);

            // Calculate if employees are missing journals
            const journalsFilledToday = todayJournalsCount || 0;
            const totalEmployees = karyawanUserIds?.size || 0;
            const employeesNeedingJournals = Math.max(0, totalEmployees - journalsFilledToday);

            return {
                journals: validJournals,
                needsReminder: needsReminder && employeesNeedingJournals > 0,
                employeesNeedingJournals,
                todayJournalsCount: journalsFilledToday
            };

        },
        refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
};

// Helper: Count working days in a month (Mon-Fri)
function getWorkingDaysInMonth(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let workingDays = 0;
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
            workingDays++;
        }
    }
    return workingDays;
}

// Helper
function getDayRangeIso(date: Date) {
    return {
        from: getJakartaStartOfDayISO(date),
        to: getJakartaEndOfDayISO(date)
    };
}

