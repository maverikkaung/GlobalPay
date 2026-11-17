import { supabase } from "./supabase.js";
import { clearLegacyUserAfterLogout } from "./logout-state.js";

export async function logoutUser() {
  const result = await supabase.auth.signOut();
  clearLegacyUserAfterLogout(result, localStorage);
  return result;
}
