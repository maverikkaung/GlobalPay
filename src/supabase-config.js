export function isPrivilegedSupabaseKey(value) {
  if (typeof value !== "string" || !value) return false;
  const key = value.trim();
  if (key.startsWith("sb_secret_")) return true;

  const segments = key.split(".");
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
  const publishableKey = environment?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const anonKey = environment?.VITE_SUPABASE_ANON_KEY?.trim() || "";
  const key = publishableKey || anonKey;

  if ([publishableKey, anonKey].some(isPrivilegedSupabaseKey)) {
    return { configured: false, url: "", key: "", reason: "privileged-key" };
  }
  if (!url) return { configured: false, url: "", key: "", reason: "missing" };

  try {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    const secureTransport = parsed.protocol === "https:" || (loopback && parsed.protocol === "http:");
    if (!secureTransport || parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { configured: false, url: "", key: "", reason: "invalid-url" };
    }
  } catch {
    return { configured: false, url: "", key: "", reason: "invalid-url" };
  }

  if (!key) return { configured: false, url: "", key: "", reason: "missing" };
  return { configured: true, url, key, reason: null };
}
