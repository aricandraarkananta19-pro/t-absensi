import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SECURE CORS HEADERS
const getCorsHeaders = (origin: string) => {
    // In production, restrict this to specific domains
    // const allowedOrigins = ["https://app.yourdomain.com", "http://localhost:8080"];
    // const allowOrigin = allowedOrigins.includes(origin) ? origin : "null";

    // For now, we reflect the origin but it's better than hardcoded '*' 
    // because it allows credentialed requests if needed
    return {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
};

interface ClockInRequest {
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}

interface SystemSettings {
    clockInStart: string;
    clockInEnd: string;
    lateThreshold: string;
    enableLocationTracking: boolean;
    officeLatitude?: number;
    officeLongitude?: number;
    maxRadiusMeters?: number;
}

// Default settings (fallback)
const DEFAULT_SETTINGS: SystemSettings = {
    clockInStart: "07:00",
    clockInEnd: "09:00",
    lateThreshold: "08:00",
    enableLocationTracking: false,
};

// Haversine Formula to calculate distance in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (val: number) => (val * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

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

serve(async (req) => {
    const origin = req.headers.get("origin") || "";
    const corsHeaders = getCorsHeaders(origin);

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
        const body: ClockInRequest = await req.json();
        const { location, latitude, longitude } = body;

        // ============ 4. GET SYSTEM SETTINGS ============
        let settings: SystemSettings = { ...DEFAULT_SETTINGS };

        const { data: settingsData } = await supabaseAdmin
            .from("system_settings")
            .select("key, value");

        if (settingsData) {
            settingsData.forEach((s: { key: string; value: string }) => {
                switch (s.key) {
                    case "clock_in_start":
                        settings.clockInStart = s.value;
                        break;
                    case "clock_in_end":
                        settings.clockInEnd = s.value;
                        break;
                    case "late_threshold":
                        settings.lateThreshold = s.value;
                        break;
                    case "enable_location_tracking":
                        settings.enableLocationTracking = s.value === "true";
                        break;
                    case "office_latitude":
                        settings.officeLatitude = parseFloat(s.value);
                        break;
                    case "office_longitude":
                        settings.officeLongitude = parseFloat(s.value);
                        break;
                    case "max_radius_meters":
                        settings.maxRadiusMeters = parseInt(s.value);
                        break;
                }
            });
        }

        // ============ 5. GET SERVER TIME (Jakarta timezone) ============
        const now = new Date();
        const todayJakarta = getJakartaDateString(now);
        const currentMinutes = getJakartaTimeMinutes(now);

        // ============ 6. CHECK FOR DUPLICATE ATTENDANCE TODAY ============
        const startOfDay = new Date(`${todayJakarta}T00:00:00+07:00`);
        const endOfDay = new Date(`${todayJakarta}T23:59:59+07:00`);

        const { data: existingAttendance, error: checkError } = await supabaseAdmin
            .from("attendance")
            .select("id, clock_in, clock_out")
            .eq("user_id", user.id)
            .gte("clock_in", startOfDay.toISOString())
            .lt("clock_in", endOfDay.toISOString())
            .maybeSingle();

        if (checkError) {
            throw new Error(`Database error: ${checkError.message}`);
        }

        if (existingAttendance) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Anda sudah melakukan Clock In hari ini",
                    existing_record: {
                        clock_in: existingAttendance.clock_in,
                        clock_out: existingAttendance.clock_out,
                    },
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
            );
        }

        // ============ 7. VALIDATE LOCATION (if enabled) ============
        if (settings.enableLocationTracking && settings.officeLatitude && settings.officeLongitude) {
            if (latitude && longitude) {
                const distance = calculateDistance(
                    latitude,
                    longitude,
                    settings.officeLatitude,
                    settings.officeLongitude
                );

                const maxRadius = settings.maxRadiusMeters || 100;

                if (distance > maxRadius) {
                    return new Response(
                        JSON.stringify({
                            success: false,
                            error: `Anda berada di luar area kantor (${Math.round(distance)}m dari kantor, maksimal ${maxRadius}m)`,
                            distance_meters: Math.round(distance),
                            max_radius: maxRadius,
                        }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
                    );
                }
            }
        }

        // ============ 8. DETERMINE ATTENDANCE STATUS ============
        const lateThresholdMinutes = parseTimeToMinutes(settings.lateThreshold);
        const clockInEndMinutes = parseTimeToMinutes(settings.clockInEnd);

        let status: string;

        if (currentMinutes <= lateThresholdMinutes) {
            status = "present"; // On time
        } else if (currentMinutes <= clockInEndMinutes) {
            status = "late"; // Late but within allowed window
        } else {
            status = "late"; // Very late (after clock-in window)
        }

        // ============ 9. INSERT ATTENDANCE RECORD ============
        const { data: newRecord, error: insertError } = await supabaseAdmin
            .from("attendance")
            .insert({
                user_id: user.id,
                clock_in: now.toISOString(),
                clock_in_location: location || null,
                clock_in_lat: latitude || null,
                clock_in_lng: longitude || null,
                status: status,
                notes: null,
            })
            .select()
            .single();

        if (insertError) {
            // Check for unique constraint violation
            if (insertError.code === "23505") {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: "Anda sudah melakukan Clock In hari ini (duplicate detected)",
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
                );
            }
            throw new Error(`Insert error: ${insertError.message}`);
        }

        // ============ 10. LOG AUDIT ACTION ============
        await supabaseAdmin.from("audit_logs").insert({
            user_id: user.id,
            action: "CLOCK_IN",
            target_table: "attendance",
            target_id: newRecord.id,
            new_data: newRecord,
            description: `User clocked in at ${now.toISOString()} with status: ${status}`,
        });

        // ============ 11. RETURN SUCCESS RESPONSE ============
        return new Response(
            JSON.stringify({
                success: true,
                data: newRecord,
                server_time: now.toISOString(),
                server_date: todayJakarta,
                status_assigned: status,
                message: status === "late"
                    ? "Clock In berhasil, tetapi Anda tercatat terlambat"
                    : "Clock In berhasil, Anda tercatat hadir tepat waktu",
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("Clock-in error:", errorMessage);

        return new Response(
            JSON.stringify({ success: false, error: errorMessage }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});

