import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match) {
        let val = match[2];
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        env[match[1]] = val;
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('attendance').select('*').limit(1);
    if (error) {
        console.error('Error fetching attendance:', error);
    } else {
        console.log('Attendance keys:', data && data[0] ? Object.keys(data[0]) : 'no records');
    }
}

check();
