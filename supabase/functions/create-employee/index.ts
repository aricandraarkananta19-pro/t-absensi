
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Setup Clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    // Fallback secret for service role
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Missing Internal Env Vars");
    }

    // 3. Authenticate Caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callerUser) throw new Error("Unauthorized");

    // 4. Verify Admin Role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Parse Body
    const requestBody = await req.json();
    const { email, password, full_name, phone, department, position, role } = requestBody;

    // 6. Create User
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: { full_name: full_name },
    });

    if (createError) throw createError;
    if (!newUser.user) throw new Error("Failed to create user object");

    // 7. Insert/Update Profile (Idempotent)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: newUser.user.id,
        full_name: full_name,
        phone: phone,
        department: department,
        position: position,
      });

    if (profileError) {
      // Cleaning up auth user if profile fails is optional but safer
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw profileError;
    }

    // 8. Insert Role
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: newUser.user.id,
        role: role,
      });

    if (roleInsertError) throw roleInsertError;

    // 9. Success Response
    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Function Error:", error);

    // Determine status code
    let status = 400;
    if (error.message === "Unauthorized") status = 401;
    if (error.message === "Missing Internal Env Vars") status = 500;

    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Unknown Error",
      stage: "execution",
      details: String(error)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: status,
    });
  }
});
