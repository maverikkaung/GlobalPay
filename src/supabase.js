import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.error("TechKarvo is missing its public Supabase URL or anonymous key.");
}

export const supabase = createClient(
  supabaseUrl || "http://127.0.0.1:54321",
  supabaseKey || "techkarvo-supabase-not-configured",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true
    }
  }
);
