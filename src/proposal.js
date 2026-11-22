import { toSafeExternalUrl } from "./external-urls.js";

export const EXPERIENCE_LEVELS = ["Beginner", "Less than 1 year", "1-2 years", "3-5 years", "5+ years"];
export const RATE_TYPES = ["Fixed Price", "Hourly"];

export function validateProposal(draft) {
  const errors = {};
  const required = {
    fullName: "Enter your full name.", country: "Enter your country or city.",
    title: "Enter your professional title.", bio: "Tell the client about yourself.",
    skills: "Enter at least one skill.", coverLetter: "Write a cover letter for this project."
  };
  for (const [field, message] of Object.entries(required)) {
    if (!draft[field].trim()) errors[field] = message;
  }
  if (!EXPERIENCE_LEVELS.includes(draft.experience)) errors.experience = "Select your years of experience.";
  if (!RATE_TYPES.includes(draft.salaryType)) errors.salaryType = "Select a rate type.";
  const rate = Number(draft.salary);
  if (!Number.isFinite(rate) || rate <= 0) errors.salary = "Enter a rate greater than zero.";
  if (draft.portfolio.trim() && !toSafeExternalUrl(draft.portfolio)) errors.portfolio = "Enter a valid HTTP or HTTPS link without credentials.";
  return errors;
}

export function availableApplicationQuota(entitlement, plan, now = Date.now()) {
  if (!entitlement || !plan || plan.id !== entitlement.plan_id || plan.account_type !== "freelancer"
    || !plan.is_active || !plan.is_simulation_only) return null;
  const starts = Date.parse(entitlement.period_started_at);
  const ends = Date.parse(entitlement.period_ends_at);
  if (!(starts <= now && now < ends)) return null;
  const values = [entitlement.period_credit_limit, entitlement.credits_used, plan.included_usage_credits];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) return null;
  const [issued, used, catalog] = values;
  return { remaining: Math.max(0, Math.min(issued, catalog) - used), ends };
}

export function buildProposal(draft, user, job) {
  return {
    job_id: job.id, client_id: job.clientId, freelancer_id: user.id,
    full_name: draft.fullName.trim(), email: user.email.trim(), country: draft.country.trim(),
    professional_title: draft.title.trim(), bio: draft.bio.trim(), skills: draft.skills.trim(),
    experience: draft.experience, cover_letter: draft.coverLetter.trim(), expected_salary: Number(draft.salary),
    salary_type: draft.salaryType, portfolio: draft.portfolio.trim(), status: "Pending"
  };
}
