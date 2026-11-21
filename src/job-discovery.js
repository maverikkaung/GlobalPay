import { matchesJobSearch, parseSkills } from "./marketplace.js";

export const JOB_FIELDS = "id,client_id,title,description,budget,category,skills,currency,payment_type,status,created_at,is_featured";

function readText(value, maxLength) {
  const text = value?.trim() || "";
  return /\p{Cc}/u.test(text) ? "" : text.slice(0, maxLength);
}

function readBudget(value) {
  return /^(?:\d{1,12}(?:\.\d{1,2})?|\.\d{1,2})$/.test(value || "") ? String(Number(value)) : "";
}

export function readJobFilters(params, categories) {
  const category = readText(params.get("category"), 120);
  return {
    query: readText(params.get("q"), 120),
    category: category === "All" || (categories && !categories.includes(category)) ? "" : category,
    sort: params.get("sort") === "title" ? "title" : "newest",
    advanced: params.get("advanced") === "1",
    minBudget: readBudget(params.get("minBudget")),
    maxBudget: readBudget(params.get("maxBudget"))
  };
}

export function writeJobFilters({ query, category, sort, advanced, minBudget, maxBudget }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (sort === "title") params.set("sort", sort);
  if (advanced) params.set("advanced", "1");
  if (minBudget) params.set("minBudget", minBudget);
  if (maxBudget) params.set("maxBudget", maxBudget);
  return params;
}

export function jobJourneyPath(path, search) {
  const params = writeJobFilters(readJobFilters(new URLSearchParams(search)));
  return params.size ? `${path}?${params}` : path;
}

export function filterJobs(jobs, filters, canUseAdvanced) {
  const useBudget = canUseAdvanced && filters.advanced;
  return jobs.filter((job) => matchesJobSearch(job, filters.query)
    && (!filters.category || job.category === filters.category)
    && (!useBudget || !filters.minBudget || job.budget >= Number(filters.minBudget))
    && (!useBudget || !filters.maxBudget || job.budget <= Number(filters.maxBudget)))
    .sort((first, second) => filters.sort === "title"
      ? first.title.localeCompare(second.title)
      : Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

export function presentJob(row, company = "") {
  return {
    id: row.id, clientId: row.client_id, company, title: row.title, description: row.description,
    category: row.category, paymentType: row.payment_type, budget: Number(row.budget),
    currency: row.currency, status: row.status, createdAt: row.created_at,
    skills: [...new Set(parseSkills(row.skills))]
  };
}

export function formatJobBudget({ budget, currency, paymentType }) {
  if (!Number.isFinite(budget) || budget <= 0 || !currency?.trim()) return "Budget unavailable";
  const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(budget);
  return `${currency} ${number}${paymentType === "Hourly" ? " / hour" : ""}`;
}
