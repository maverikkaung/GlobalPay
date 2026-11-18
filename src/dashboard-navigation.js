export const QUICK_ACTIONS = {
  Client: [
    ["Daily Feed", "/social"],
    ["Post a Job", "/post-job"],
    ["My Applicants", "/job-applicants"],
    ["My Freelancers", "/my-freelancers"],
    ["My Projects", "/my-projects"],
    ["Reviews", "/reviews"]
  ],
  Freelancer: [
    ["Daily Feed", "/social"],
    ["Find Jobs", "/jobs"],
    ["My Applications", "/my-applications"],
    ["My Portfolio", "/portfolio"],
    ["Reviews", "/reviews"]
  ]
};

export function getQuickActions(accountType) {
  return QUICK_ACTIONS[accountType] || [];
}

export function getProfilePath(accountType) {
  if (accountType === "Client") return "/client-profile";
  if (accountType === "Freelancer") return "/freelancer-profile";
  return null;
}
