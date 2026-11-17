export function clearLegacyUserAfterLogout(result, storage) {
  if (!result?.error) {
    storage.removeItem("TechKarvo_current_user");
  }
}
