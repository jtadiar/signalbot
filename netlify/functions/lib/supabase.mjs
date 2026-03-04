import { createClient } from '@supabase/supabase-js';

let client;

export function supabase() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return client;
}
