export function getEmailVerificationStatus(authUser) {
  if (!authUser || typeof authUser !== "object" || !authUser.id) return "unavailable";
  return authUser.email_confirmed_at ? "verified" : "unverified";
}

export function getEmailVerificationLabel(status) {
  if (status === "loading") return "Checking verification status…";
  if (status === "verified") return "Verified";
  if (status === "unverified") return "Not verified";
  return "Verification status unavailable";
}
