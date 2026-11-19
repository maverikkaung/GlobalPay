export function isPrivilegedSupabaseKey(value) {
  if (typeof value !== "string" || !value) return false;
  if (value.startsWith("sb_secret_")) return true;

  const segments = value.split(".");
  if (segments.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(segments[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function getSupabaseBrowserConfig(environment) {
  const url = environment?.VITE_SUPABASE_URL?.trim() || "";
  const key = environment?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    || environment?.VITE_SUPABASE_ANON_KEY?.trim()
    || "";

  if (!url || !key) return { configured: false, url, key: "", reason: "missing" };
  if (isPrivilegedSupabaseKey(key)) return { configured: false, url, key: "", reason: "privileged-key" };

  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      return { configured: false, url: "", key: "", reason: "invalid-url" };
    }
  } catch {
    return { configured: false, url: "", key: "", reason: "invalid-url" };
  }

  return { configured: true, url, key, reason: null };
}
