import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "./supabase-config.js";

const config = getSupabaseBrowserConfig(import.meta.env);
const supabaseUrl = config.url;
const supabaseKey = config.key;
export const isSupabaseConfigured = config.configured;

if (!isSupabaseConfigured) {
  console.error(config.reason === "privileged-key"
    ? "TechKarvo rejected a privileged Supabase key in browser configuration. Use a publishable key."
    : "TechKarvo is missing a valid public Supabase URL or publishable key.");
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
