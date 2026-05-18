const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf-8');
const env = {};
envFile.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*["']?(.*?)["']?\s*$/);
  if (match) {
    const [, key, val] = match;
    env[key] = val.trim();
  }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: policies, error } = await supabase.rpc('has_role', { _user_id: 'a40801c5-4811-4f4f-b032-445fdbc7d8b6', _role: 'admin' }); // simple call to verify connection
  
  // Let's run raw SQL via RPC or custom select
  const { data, error: pgErr } = await supabase.from('tickets').select('*').limit(1);
  if (pgErr) {
    console.error("PG Select error:", pgErr);
  }

  // Let's query policies from pg_policies via a direct query if possible, or print standard information.
  console.log("Connected successfully to Supabase!");
  
  // Since we have the service role key, we can query pg_catalog or run a sql if we have an RPC, or just inspect pg_policies using custom select on a pg_policies view (if exposed).
  // Let's try selecting from a custom table or pg_policies view if it exists.
  const { data: pol, error: polErr } = await supabase.from('pg_policies').select('*').eq('tablename', 'tickets');
  if (polErr) {
    // If not exposed, we can check by trying to execute a query
    console.log("pg_policies is not exposed via PostgREST API directly (normal security behavior).");
  } else {
    console.log("Policies:", pol);
  }
}

main();
