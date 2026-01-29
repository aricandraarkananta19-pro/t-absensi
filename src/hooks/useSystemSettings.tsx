import { useState, useEffect, useCallback } from "react";
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
  attendanceStartDate: new Date().toISOString().split("T")[0],
};

// Helper function to safely parse integer with fallback
const safeParseInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
};

export const useSystemSettings = () => {
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

    // Setup realtime subscription
    const channel = supabase
      .channel("settings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        () => fetchSettings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  // Helper function to check if time is after threshold
  const isAfterTime = (threshold: string): boolean => {
    const now = new Date();
    const [hours, minutes] = threshold.split(":").map(Number);
    const thresholdTime = new Date();
    thresholdTime.setHours(hours, minutes, 0, 0);
    return now >= thresholdTime;
  };

  // Helper function to check if time is before threshold
  const isBeforeTime = (threshold: string): boolean => {
    const now = new Date();
    const [hours, minutes] = threshold.split(":").map(Number);
    const thresholdTime = new Date();
    thresholdTime.setHours(hours, minutes, 0, 0);
    return now < thresholdTime;
  };

  // Helper function to check if a date is within the active attendance period
  const isWithinAttendancePeriod = (date: Date): boolean => {
    const startDate = new Date(settings.attendanceStartDate);
    startDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate >= startDate;
  };

  // Get attendance start date as Date object
  const getAttendanceStartDate = (): Date => {
    return new Date(settings.attendanceStartDate);
  };

  return {
    settings,
    isLoading,
    loadError,
    isAfterTime,
    isBeforeTime,
    isWithinAttendancePeriod,
    getAttendanceStartDate,
    refetch: fetchSettings,
  };
};
