import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin":  req.headers.get("origin") || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ClockOutRequest {
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}

interface SystemSettings {
    clockOutStart: string;
    clockOutEnd: string;
    enableLocationTracking: boolean;
}

// Default settings (fallback)
const DEFAULT_SETTINGS: SystemSettings = {
    clockOutStart: "17:00",
    clockOutEnd: "21:00",
    enableLocationTracking: false,
};

// Parse time string (HH:MM) to minutes since midnight
function parseTimeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

// Get current time in Jakarta timezone as minutes since midnight
function getJakartaTimeMinutes(date: Date): number {
    const jakartaTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    return jakartaTime.getHours() * 60 + jakartaTime.getMinutes();
}

// Get Jakarta date string (YYYY-MM-DD)
function getJakartaDateString(date: Date): string {
    return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// Calculate work hours
function calculateWorkHours(clockIn: Date, clockOut: Date): number {
    const diffMs = clockOut.getTime() - clockIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100; // Round to 2 decimal places
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // ============ 1. INITIALIZE SUPABASE CLIENTS ============
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Client for user authentication (uses user's JWT)
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, error: "Unauthorized: No authorization header" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
            );
        }

        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // Admin client for database operations (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // ============ 2. VERIFY USER AUTHENTICATION ============
        const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

        if (userError || !user) {
            return new Response(
                JSON.stringify({ success: false, error: "Unauthorized: Invalid or expired session" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
            );
        }

        // ============ 3. PARSE REQUEST BODY ============
        const body: ClockOutRequest = await req.json();
        const { location, latitude, longitude } = body;

        // ============ 4. GET SYSTEM SETTINGS ============
        let settings: SystemSettings = { ...DEFAULT_SETTINGS };

        const { data: settingsData } = await supabaseAdmin
            .from("system_settings")
            .select("key, value");

        if (settingsData) {
            settingsData.forEach((s: { key: string; value: string }) => {
                switch (s.key) {
                    case "clock_out_start":
                        settings.clockOutStart = s.value;
                        break;
                    case "clock_out_end":
                        settings.clockOutEnd = s.value;
                        break;
                    case "enable_location_tracking":
                        settings.enableLocationTracking = s.value === "true";
                        break;
                }
            });
        }

        // ============ 5. GET SERVER TIME (Jakarta timezone) ============
        const now = new Date();
        const todayJakarta = getJakartaDateString(now);
        const currentMinutes = getJakartaTimeMinutes(now);

        // ============ 6. FIND TODAY'S ATTENDANCE RECORD ============
        const startOfDay = new Date(`${todayJakarta}T00:00:00+07:00`);
        const endOfDay = new Date(`${todayJakarta}T23:59:59+07:00`);

        const { data: todayAttendance, error: findError } = await supabaseAdmin
            .from("attendance")
            .select("*")
            .eq("user_id", user.id)
            .gte("clock_in", startOfDay.toISOString())
            .lt("clock_in", endOfDay.toISOString())
            .maybeSingle();

        if (findError) {
            throw new Error(`Database error: ${findError.message}`);
        }

        // ============ 7. VALIDATE CLOCK-IN EXISTS ============
        if (!todayAttendance) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Anda belum melakukan Clock In hari ini. Silakan Clock In terlebih dahulu.",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
            );
        }

        // ============ 8. CHECK IF ALREADY CLOCKED OUT ============
        if (todayAttendance.clock_out) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Anda sudah melakukan Clock Out hari ini",
                    existing_record: {
                        clock_in: todayAttendance.clock_in,
                        clock_out: todayAttendance.clock_out,
                    },
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
            );
        }

        // ============ 9. DETERMINE IF EARLY LEAVE ============
        const clockOutStartMinutes = parseTimeToMinutes(settings.clockOutStart);
        const isEarlyLeave = currentMinutes < clockOutStartMinutes;

        // Update status if early leave
        let finalStatus = todayAttendance.status;
        if (isEarlyLeave && finalStatus === "present") {
            finalStatus = "early_leave";
        }

        // ============ 10. CALCULATE WORK HOURS ============
        const clockInTime = new Date(todayAttendance.clock_in);
        const workHours = calculateWorkHours(clockInTime, now);

        // ============ 11. UPDATE ATTENDANCE RECORD ============
        const { data: updatedRecord, error: updateError } = await supabaseAdmin
            .from("attendance")
            .update({
                clock_out: now.toISOString(),
                clock_out_location: location || null,
                clock_out_lat: latitude || null,
                clock_out_lng: longitude || null,
                status: finalStatus,
                work_hours: workHours,
            })
            .eq("id", todayAttendance.id)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Update error: ${updateError.message}`);
        }

        // ============ 12. LOG AUDIT ACTION ============
        await supabaseAdmin.from("audit_logs").insert({
            user_id: user.id,
            action: "CLOCK_OUT",
            target_table: "attendance",
            target_id: updatedRecord.id,
            old_data: todayAttendance,
            new_data: updatedRecord,
            description: `User clocked out at ${now.toISOString()}. Work hours: ${workHours}h. Status: ${finalStatus}`,
        });

        // ============ 13. RETURN SUCCESS RESPONSE ============
        return new Response(
            JSON.stringify({
                success: true,
                data: updatedRecord,
                server_time: now.toISOString(),
                server_date: todayJakarta,
                work_hours: workHours,
                is_early_leave: isEarlyLeave,
                final_status: finalStatus,
                message: isEarlyLeave
                    ? `Clock Out berhasil (Pulang Awal). Total kerja: ${workHours} jam`
                    : `Clock Out berhasil. Total kerja: ${workHours} jam`,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Clock-out error:", errorMessage);

        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});

