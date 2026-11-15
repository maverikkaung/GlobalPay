import { supabase } from "./supabase.js";

const CURRENT_USER_KEY = "TechKarvo_current_user";

export function getCurrentUser() {
  try {
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);

    if (!savedUser) {
      return null;
    }

    return JSON.parse(savedUser);
  } catch {
    return null;
  }
}

export async function logoutUser() {
  const result = await supabase.auth.signOut();

  localStorage.removeItem(CURRENT_USER_KEY);

  return result;
}
