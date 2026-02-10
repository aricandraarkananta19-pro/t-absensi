import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SystemSettings {
    companyName: string;
    clockInStart: string;
    clockInEnd: string;
    clockOutStart: string;
    clockOutEnd: string;
    lateThreshold: string;
    enableLocationTracking: boolean;
    enableNotifications: boolean;
    requirePhotoOnClockIn: boolean;
    autoClockOut: boolean;
    autoClockOutTime: string;
    maxLeaveDays: number;
    attendanceStartDate: string;
}

const defaultSettings: SystemSettings = {
    companyName: "PT. Talenta Traincom Indonesia",
    clockInStart: "08:00",
    clockInEnd: "09:00",
    clockOutStart: "17:00",
    clockOutEnd: "18:00",
    lateThreshold: "09:00",
    enableLocationTracking: true,
    enableNotifications: true,
    requirePhotoOnClockIn: false,
    autoClockOut: false,
    autoClockOutTime: "22:00",
    maxLeaveDays: 12,
    attendanceStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0], // Default to start of current month
};

// Helper function to safely parse integer with fallback
const safeParseInt = (value: string | undefined, fallback: number): number => {
    if (!value) return fallback;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
};

interface SystemSettingsContextType {
    settings: SystemSettings;
    isLoading: boolean;
    loadError: string | null;
    updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
    refetch: () => Promise<void>;
}

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const useSystemSettingsContext = () => {
    const context = useContext(SystemSettingsContext);
    if (!context) {
        throw new Error("useSystemSettingsContext must be used within a SystemSettingsProvider");
    }
    return context;
};

export const SystemSettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        setLoadError(null);
        try {
            const { data, error } = await supabase
                .from("system_settings")
                .select("key, value");

            if (error) throw error;

            // Disable caching for attendance period to ensure freshness
            const { data: periodData } = await supabase
                .from("attendance_periods")
                .select("start_date")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .maybeSingle();

            if (data) {
                const settingsMap: Record<string, string> = {};
                data.forEach((item: { key: string; value: string }) => {
                    settingsMap[item.key] = item.value;
                });

                // Use periodData.start_date if available, otherwise fallback to system_settings or default
                const activeStartDate = periodData?.start_date || settingsMap.attendance_start_date || defaultSettings.attendanceStartDate;

                setSettings({
                    companyName: settingsMap.company_name || defaultSettings.companyName,
                    clockInStart: settingsMap.clock_in_start || defaultSettings.clockInStart,
                    clockInEnd: settingsMap.clock_in_end || defaultSettings.clockInEnd,
                    clockOutStart: settingsMap.clock_out_start || defaultSettings.clockOutStart,
                    clockOutEnd: settingsMap.clock_out_end || defaultSettings.clockOutEnd,
                    lateThreshold: settingsMap.late_threshold || defaultSettings.lateThreshold,
                    enableLocationTracking: settingsMap.enable_location_tracking === "true",
                    enableNotifications: settingsMap.enable_notifications === "true",
                    requirePhotoOnClockIn: settingsMap.require_photo_on_clock_in === "true",
                    autoClockOut: settingsMap.auto_clock_out === "true",
                    autoClockOutTime: settingsMap.auto_clock_out_time || defaultSettings.autoClockOutTime,
                    // NaN protection for maxLeaveDays
                    maxLeaveDays: safeParseInt(settingsMap.max_leave_days, defaultSettings.maxLeaveDays),
                    attendanceStartDate: activeStartDate,
                });
            }
        } catch (error: any) {
            console.error("Error fetching settings:", error);
            setLoadError(error.message || "Failed to load settings");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Map camelCase keys to snake_case for DB
    const mapToDbKey = (key: string): string => {
        const mapping: Record<string, string> = {
            companyName: "company_name",
            clockInStart: "clock_in_start",
            clockInEnd: "clock_in_end",
            clockOutStart: "clock_out_start",
            clockOutEnd: "clock_out_end",
            lateThreshold: "late_threshold",
            enableLocationTracking: "enable_location_tracking",
            enableNotifications: "enable_notifications",
            requirePhotoOnClockIn: "require_photo_on_clock_in",
            autoClockOut: "auto_clock_out",
            autoClockOutTime: "auto_clock_out_time",
            maxLeaveDays: "max_leave_days",
            attendanceStartDate: "attendance_start_date",
        };
        return mapping[key] || key;
    };

    const updateSettings = async (newSettings: Partial<SystemSettings>) => {
        // Optimistic Update
        setSettings((prev) => ({ ...prev, ...newSettings }));

        try {
            const updates = Object.entries(newSettings).map(([key, value]) => ({
                key: mapToDbKey(key),
                value: typeof value === "boolean" ? value.toString() : value.toString(),
                updated_at: new Date().toISOString(),
            }));

            for (const update of updates) {
                const { error } = await supabase
                    .from("system_settings")
                    .upsert(update, { onConflict: "key" });

                if (error) throw error;
            }
        } catch (error: any) {
            console.error("Error updating settings:", error);
            // Revert if needed, but for settings usually user sees error toast via UI component
            throw error;
        }
    };

    return (
        <SystemSettingsContext.Provider value={{ settings, isLoading, loadError, updateSettings, refetch: fetchSettings }}>
            {children}
        </SystemSettingsContext.Provider>
    );
};
