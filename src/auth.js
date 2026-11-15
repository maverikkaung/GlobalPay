import { supabase } from "./supabase.js";

export async function logoutUser() {
  const result = await supabase.auth.signOut();
  localStorage.removeItem("TechKarvo_current_user");
  return result;
}
