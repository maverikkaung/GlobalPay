export const PROFILE_FIELDS = "id,full_name,account_type,country,professional_title,bio,skills,experience,portfolio_url,avatar_path,cover_path";
export const PROJECT_FIELDS = "id,title,description,project_url,image_url";
export const REVIEW_FIELDS = "id,rating,body,created_at";

export function isProfileId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

export function mayShowPortfolio(profile, viewer) {
  return profile.account_type === "freelancer" && Boolean(viewer?.id) &&
    (viewer.id === profile.id || viewer.accountType === "Client");
}

export function profileSkills(value) {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((skill) => skill.trim()).filter(Boolean))];
}

export function profileMediaPath(path, ownerId) {
  if (typeof path !== "string" || !path.startsWith(`${ownerId}/`)) return null;
  return path.split("/").every((part) => part && !/[\\%?#]/u.test(part)
    && !Array.from(part).some((char) => char.charCodeAt(0) < 32) && part !== "." && part !== "..")
    ? path : null;
}

export function profileConnection(connection, viewerId) {
  if (connection?.status === "Accepted") return { label: "Message", disabled: false };
  if (connection?.status === "Pending") return connection.requester_id === viewerId
    ? { label: "Request pending", disabled: true }
    : { label: "Accept connection", disabled: false };
  if (connection?.status === "Declined") return { label: "Request declined", disabled: true };
  return { label: "Connect", disabled: false };
}
