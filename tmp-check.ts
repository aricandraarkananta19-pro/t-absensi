import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_APP_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_APP_KEY';

// I need real URL from environment or .env
