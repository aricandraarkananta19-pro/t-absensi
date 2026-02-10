/**
 * Dashboard Fallback Data Utilities
 * Provides fallback states and test data for dashboard components
 */

// Brand Colors (matching dashboard)
export const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

// Chart Colors
export const CHART_COLORS = {
    primary: BRAND_COLORS.blue,
    success: BRAND_COLORS.green,
    warning: "#F59E0B",
    danger: "#EF4444",
    lightBlue: BRAND_COLORS.lightBlue,
    purple: "#8B5CF6",
    pink: "#EC4899",
};

// Empty State Messages
export const EMPTY_STATE_MESSAGES = {
    attendance: {
        title: "Belum ada data kehadiran",
        description: "Data akan muncul saat karyawan melakukan clock-in",
    },
    journals: {
        title: "Belum ada jurnal",
        description: "Data jurnal kerja akan muncul di sini",
    },
    realTimeMonitoring: {
        title: "Belum ada aktivitas hari ini",
        description: "Data akan muncul saat karyawan clock-in",
    },
    monthlyTrend: {
        title: "Belum ada data bulanan",
        description: "Data tren kehadiran akan muncul seiring waktu",
    },
    departmentDistribution: {
        title: "Belum ada data departemen",
        description: "Pastikan karyawan sudah memiliki departemen yang ditetapkan",
    },
    weeklyTrend: {
        title: "Belum ada data mingguan",
        description: "Data kehadiran minggu ini akan muncul di sini",
    },
};

// Test Data for Development Mode
export const TEST_DATA = {
    // Dashboard Stats
    stats: {
        totalEmployees: 25,
        presentToday: 20,
        lateToday: 3,
        absentToday: 2,
        departments: 5,
        pendingLeave: 2,
        onTimeRate: 85,
    },

    // Live Stats
    liveStats: {
        clockedInToday: 18,
        lateToday: 2,
        lastClockIn: new Date().toISOString(),
        hasData: true,
    },

    // Weekly Trend
    weeklyTrend: [
        { day: "Sen", hadir: 22, terlambat: 2 },
        { day: "Sel", hadir: 24, terlambat: 1 },
        { day: "Rab", hadir: 21, terlambat: 3 },
        { day: "Kam", hadir: 23, terlambat: 2 },
        { day: "Jum", hadir: 20, terlambat: 4 },
        { day: "Sab", hadir: 5, terlambat: 1 },
        { day: "Min", hadir: 0, terlambat: 0 },
    ],

    // Monthly Trend
    monthlyTrend: [
        { month: "Sep", year: 2025, attendanceRate: 92, onTimeRate: 88, total: 460, late: 55 },
        { month: "Okt", year: 2025, attendanceRate: 94, onTimeRate: 90, total: 485, late: 48 },
        { month: "Nov", year: 2025, attendanceRate: 91, onTimeRate: 85, total: 442, late: 66 },
        { month: "Des", year: 2025, attendanceRate: 88, onTimeRate: 82, total: 410, late: 74 },
        { month: "Jan", year: 2026, attendanceRate: 93, onTimeRate: 89, total: 478, late: 52 },
        { month: "Feb", year: 2026, attendanceRate: 90, onTimeRate: 86, total: 450, late: 63 },
    ],

    // Department Distribution
    departmentDistribution: [
        { name: "IT", count: 8, color: CHART_COLORS.primary },
        { name: "HR", count: 5, color: CHART_COLORS.success },
        { name: "Finance", count: 4, color: CHART_COLORS.warning },
        { name: "Marketing", count: 4, color: CHART_COLORS.danger },
        { name: "Operations", count: 4, color: CHART_COLORS.purple },
    ],

    // Recent Journals
    recentJournals: {
        journals: [
            {
                id: "1",
                user_id: "u1",
                full_name: "Ahmad Surya",
                title: "Implementasi fitur dashboard",
                created_at: new Date().toISOString(),
                date: new Date().toISOString().split("T")[0],
                status: "approved" as const,
            },
            {
                id: "2",
                user_id: "u2",
                full_name: "Dewi Lestari",
                title: "Review code backend",
                created_at: new Date().toISOString(),
                date: new Date().toISOString().split("T")[0],
                status: "pending" as const,
            },
            {
                id: "3",
                user_id: "u3",
                full_name: "Budi Santoso",
                title: "Meeting dengan client",
                created_at: new Date().toISOString(),
                date: new Date().toISOString().split("T")[0],
                status: "submitted" as const,
            },
        ],
        needsReminder: false,
        employeesNeedingJournals: 0,
        todayJournalsCount: 3,
    },

    // Real-Time Monitoring
    realTimeMonitoring: [
        {
            id: "1",
            user_id: "u1",
            full_name: "Ahmad Surya",
            department: "IT",
            clock_in: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            clock_out: null,
            status: "present",
            liveStatus: "online" as const,
            shift: "08:00 - 17:00",
        },
        {
            id: "2",
            user_id: "u2",
            full_name: "Dewi Lestari",
            department: "HR",
            clock_in: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            clock_out: null,
            status: "late",
            liveStatus: "late" as const,
            shift: "08:00 - 17:00",
        },
        {
            id: "3",
            user_id: "u3",
            full_name: "Budi Santoso",
            department: "Finance",
            clock_in: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            clock_out: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            status: "present",
            liveStatus: "inactive" as const,
            shift: "08:00 - 17:00",
        },
    ],
};

/**
 * Check if data is empty and should show fallback
 */
export function shouldShowFallback<T>(data: T[] | undefined | null): boolean {
    return !data || data.length === 0;
}

/**
 * Get fallback data for development/testing mode
 * Set USE_TEST_DATA=true in environment or local storage to enable
 */
export function getTestDataIfEnabled<K extends keyof typeof TEST_DATA>(
    key: K,
    realData: typeof TEST_DATA[K] | undefined | null
): typeof TEST_DATA[K] | undefined | null {
    const useTestData =
        typeof window !== "undefined" &&
        (localStorage.getItem("USE_TEST_DATA") === "true" ||
            process.env.NODE_ENV === "development" && !realData);

    if (useTestData && shouldShowFallback(realData as any[])) {
        console.log(`[Dashboard] Using test data for: ${key}`);
        return TEST_DATA[key];
    }

    return realData;
}

/**
 * Safe wrapper for displaying numeric values
 * Returns 0 if value is null/undefined, prevents NaN display
 */
export function safeNumber(value: number | undefined | null, fallback: number = 0): number {
    if (value === null || value === undefined || isNaN(value)) {
        return fallback;
    }
    return value;
}

/**
 * Format percentage with safe handling
 */
export function safePercentage(value: number | undefined | null): string {
    const num = safeNumber(value, 0);
    return `${num}%`;
}
