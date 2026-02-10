import { useSystemSettingsContext } from "@/contexts/SystemSettingsContext";
import type { SystemSettings } from "@/contexts/SystemSettingsContext";

export type { SystemSettings };

export const useSystemSettings = () => {
  const { settings, isLoading, loadError, updateSettings, refetch } = useSystemSettingsContext();

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
    updateSettings,
    isAfterTime,
    isBeforeTime,
    isWithinAttendancePeriod,
    getAttendanceStartDate,
    refetch,
  };
};
