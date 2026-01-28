
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  udt_name: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // Fallback logic
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    if (!supabaseServiceKey) throw new Error("Missing Env Vars");

    // Create client with user's token to verify auth
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify token and get user
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token)

    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = claimsData.user.id

    // Check if user is admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (roleError || !roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Tables to export
    const tables = ['profiles', 'attendance', 'leave_requests', 'user_roles', 'system_settings']

    let sqlDump = ''
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    // Header
    sqlDump += `-- ================================================\n`
    sqlDump += `-- Database Export from Lovable Cloud\n`
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`
    sqlDump += `-- Tables: ${tables.join(', ')}\n`
    sqlDump += `-- ================================================\n\n`

    // Create app_role enum
    sqlDump += `-- Create enum type for roles\n`
    sqlDump += `DO $$ BEGIN\n`
    sqlDump += `    CREATE TYPE app_role AS ENUM ('admin', 'karyawan', 'manager');\n`
    sqlDump += `EXCEPTION\n`
    sqlDump += `    WHEN duplicate_object THEN null;\n`
    sqlDump += `END $$;\n\n`

    // Generate CREATE TABLE statements
    for (const tableName of tables) {
      sqlDump += `-- ================================================\n`
      sqlDump += `-- Table: ${tableName}\n`
      sqlDump += `-- ================================================\n\n`

      // Get column information using direct query
      const { data: columns, error: colError } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .limit(0)

      if (colError) {
        sqlDump += `-- Error getting schema for ${tableName}: ${colError.message}\n\n`
        continue
      }

      // Generate CREATE TABLE based on known schema
      sqlDump += generateCreateTable(tableName)
      sqlDump += '\n'

      // Get all data from table
      const { data: rows, error: dataError } = await supabaseAdmin
        .from(tableName)
        .select('*')

      if (dataError) {
        sqlDump += `-- Error fetching data for ${tableName}: ${dataError.message}\n\n`
        continue
      }

      if (!rows || rows.length === 0) {
        sqlDump += `-- No data in table ${tableName}\n\n`
        continue
      }

      // Generate INSERT statements
      sqlDump += `-- Data for ${tableName} (${rows.length} rows)\n`

      for (const row of rows) {
        const columns = Object.keys(row)
        const values = columns.map(col => formatValue(row[col]))

        sqlDump += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`
      }

      sqlDump += '\n'
    }

    // Footer
    sqlDump += `-- ================================================\n`
    sqlDump += `-- End of export\n`
    sqlDump += `-- ================================================\n`

    // Return as downloadable file
    const filename = `lovable_database_export_${timestamp}.sql`

    return new Response(sqlDump, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Export error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateCreateTable(tableName: string): string {
  const schemas: Record<string, string> = {
    profiles: `
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    full_name TEXT,
    department TEXT,
    position TEXT,
    phone TEXT,
    address TEXT,
    avatar_url TEXT,
    join_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
`,
    attendance: `
DROP TABLE IF EXISTS public.attendance CASCADE;
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
    clock_out TIMESTAMPTZ,
    clock_in_location TEXT,
    clock_out_location TEXT,
    status TEXT NOT NULL DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX idx_attendance_clock_in ON public.attendance(clock_in);
`,
    leave_requests: `
DROP TABLE IF EXISTS public.leave_requests CASCADE;
CREATE TABLE public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
`,
    user_roles: `
DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'karyawan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
`,
    system_settings: `
DROP TABLE IF EXISTS public.system_settings CASCADE;
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_system_settings_key ON public.system_settings(key);
`
  }

  return schemas[tableName] || `-- Unknown table: ${tableName}\n`
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`
  }

  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`
  }

  // String - escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`
}
