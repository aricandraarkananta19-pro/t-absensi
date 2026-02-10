
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SystemSettings {
    autoClockOut: boolean;
    autoClockOutTime: string;
    clockOutStart: string;
}

// Default settings (fallback)
const DEFAULT_SETTINGS: SystemSettings = {
    autoClockOut: false,
    autoClockOutTime: "23:59", // Default to end of day if enabled but not set
    clockOutStart: "17:00",
};

// Parse time string (HH:MM) to minutes since midnight
function parseTimeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

// Get Jakarta date string (YYYY-MM-DD)
function getJakartaDateString(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// Get Date object from Jakarta date string and time string
function getJakartaDateTime(dateStr: string, timeStr: string): Date {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date(dateStr); // This is UTC, but we need to treat it as Jakarta base
    // Actually, constructing a Date in specific timezone in JS environments is tricky without libraries.
    // simpler: Create a string "YYYY-MM-DDTHH:mm:00+07:00"
    return new Date(`${dateStr}T${timeStr.padStart(5, '0')}:00+07:00`);
}

// Calculate work hours
function calculateWorkHours(clockIn: Date, clockOut: Date): number {
    const diffMs = clockOut.getTime() - clockIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Admin client for database operations (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // ============ 1. GET SYSTEM SETTINGS ============
        const settings: SystemSettings = { ...DEFAULT_SETTINGS };

        const { data: settingsData, error: settingsError } = await supabaseAdmin
            .from("system_settings")
            .select("key, value");

        if (settingsError) throw settingsError;

        if (settingsData) {
            settingsData.forEach((s: { key: string; value: string }) => {
                switch (s.key) {
                    case "auto_clock_out":
                        settings.autoClockOut = s.value === "true";
                        break;
                    case "auto_clock_out_time":
                        settings.autoClockOutTime = s.value;
                        break;
                    case "clock_out_start":
                        settings.clockOutStart = s.value;
                        break;
                }
            });
        }

        // Check if feature is enabled
        if (!settings.autoClockOut) {
            return new Response(
                JSON.stringify({ success: true, message: "Auto clock-out is disabled in settings.", processed: 0 }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ============ 2. CHECK TIME CONDITION ============
        const now = new Date();
        const jakartaDateStr = getJakartaDateString(now);
        const autoClockOutTimeForToday = getJakartaDateTime(jakartaDateStr, settings.autoClockOutTime);

        // Ensure accurate comparison by getting current time in Jakarta context or just comparing timestamps
        // convert now to Jakarta string then back to date? 
        // Best approach: Compare ISO strings or timestamps if we trust the construction.
        // `autoClockOutTimeForToday` is explicitly constructed with +07:00.
        // `now` is UTC (Date object).

        // If NOW is before the configured time, we do nothing.
        // Example: Now is 17:00. AutoClockOut is 18:00. 17:00 < 18:00. Return.
        if (now.getTime() < autoClockOutTimeForToday.getTime()) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: `Too early to run auto clock-out. Configured: ${settings.autoClockOutTime} (Jakarta), Now: ${now.toISOString()}`,
                    processed: 0
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ============ 3. FETCH OPEN ATTENDANCE RECORDS ============
        // Find records for "today" (Jakarta) that have no clock_out
        const startOfDay = new Date(`${jakartaDateStr}T00:00:00+07:00`);
        const endOfDay = new Date(`${jakartaDateStr}T23:59:59+07:00`);

        const { data: openAttendances, error: fetchError } = await supabaseAdmin
            .from("attendance")
            .select("*")
            .gte("clock_in", startOfDay.toISOString())
            .lt("clock_in", endOfDay.toISOString())
            .is("clock_out", null);

        if (fetchError) throw fetchError;

        if (!openAttendances || openAttendances.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: "No open attendance records found for today.", processed: 0 }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ============ 4. PROCESS AUTO CLOCK-OUT ============
        const updates = [];

        // We use the AutoClockOutTime as the clock_out time, 
        // UNLESS the current time is significantly later? 
        // No, best to use the Scheduled Time to keep records clean, 
        // OR use NOW() to reflect when the system actually processed it.
        // Using NOW() is safer for audit.
        const clockOutTimestamp = now.toISOString();

        for (const record of openAttendances) {
            // Determine status
            // If they are auto-clocked out, is it 'present'? 
            // Usually status is determined at Clock In. But if they leave early?
            // If the auto-clock-out time is AFTER the normal clock-out time, they are 'present'.
            // If auto-clock-out time is earlier (weird config), maybe early_leave.

            // We'll calculate work hours based on the actual clock out time (now)
            const workHours = calculateWorkHours(new Date(record.clock_in), now);

            // Logic for Early Leave check based on Settings
            const clockOutStartMinutes = parseTimeToMinutes(settings.clockOutStart);
            const autoClockOutMinutes = parseTimeToMinutes(settings.autoClockOutTime);
            // Since we are running this AFTER the autoClockOutTime, 
            // and assuming autoClockOutTime >= clockOutStart (usually),
            // then it is likely 'present'.
            // However, we should respect the logic: 
            // If the time used for clock_out (now) is < clock_out_start, then early_leave.
            // But we already checked now >= autoClockOutTime.

            // So status remains 'present' unless it was already late/etc.
            // Actually, we should preserve the 'late' status if it was set at clock_in.
            // But if it was 'present' and they left early (unlikely if auto-clocked out late), it stays 'present'.

            updates.push(
                supabaseAdmin
                    .from("attendance")
                    .update({
                        clock_out: clockOutTimestamp,
                        work_hours: workHours,
                        notes: (record.notes ? record.notes + "\n" : "") + "[System] Auto Clock-Out",
                        // Keep existing status
                    })
                    .eq("id", record.id)
            );

            // Log audit
            updates.push(
                supabaseAdmin.from("audit_logs").insert({
                    user_id: record.user_id, // Attributing to the user, or maybe system? user_id referential integrity might require a valid user.
                    // The audit_logs might have user_id NOT NULL. If so, use the user's ID.
                    action: "AUTO_CLOCK_OUT",
                    target_table: "attendance",
                    target_id: record.id,
                    description: `System auto clocked out employee. Time: ${clockOutTimestamp}`
                })
            );
        }

        await Promise.all(updates);

        return new Response(
            JSON.stringify({
                success: true,
                message: `Successfully auto clocked out ${openAttendances.length} users.`,
                processed: openAttendances.length,
                timestamp: clockOutTimestamp
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
