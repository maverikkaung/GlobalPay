export const JOB_CATEGORIES = [
  "Web Development",
  "Graphic Design",
  "Writing",
  "Marketing",
  "Video Editing",
  "Other"
];

export function getJobCategories(jobs = []) {
  const storedCategories = jobs
    .map((job) => String(job.category || "").trim())
    .filter(Boolean);
  return ["All", ...new Set([...JOB_CATEGORIES, ...storedCategories])];
}

export function normalizeAccountType(value) {
  if (value === "freelancer") return "Freelancer";
  if (value === "client") return "Client";
  return null;
}

export function countApplicationStatuses(applications = []) {
  return applications.reduce((counts, application) => {
    if (application.status === "Accepted") counts.accepted += 1;
    if (application.status === "Pending") counts.pending += 1;
    if (application.status === "Rejected") counts.rejected += 1;
    if (application.status === "Withdrawn") counts.withdrawn += 1;
    return counts;
  }, { accepted: 0, pending: 0, rejected: 0, withdrawn: 0 });
}

export function countOpenAcceptedJobs(applications = [], jobs = []) {
  const openJobIds = new Set(jobs
    .filter((job) => job.status === "open")
    .map((job) => String(job.id)));
  return new Set(applications
    .filter((application) => application.status === "Accepted" && openJobIds.has(String(application.job_id)))
    .map((application) => String(application.job_id))).size;
}

export function countUnreadMessagesByConversation(messages = []) {
  return messages.reduce((counts, message) => {
    const key = String(message.conversation_id);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

export function calculateClientHiringMetrics(applications = [], jobs = []) {
  const accepted = applications.filter((item) => item.status === "Accepted");
  const acceptedJobIds = new Set(accepted.map((item) => String(item.job_id)));
  const totalSpending = jobs.reduce((sum, job) => acceptedJobIds.has(String(job.id))
    ? sum + Number(job.budget || 0)
    : sum, 0);

  return { totalHires: accepted.length, totalSpending };
}

export function parseSkills(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return values.map((skill) => String(skill).trim()).filter(Boolean);
}

export function matchesJobSearch(job = {}, query = "") {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return true;

  const searchableValues = [job.title, job.company, job.description, ...parseSkills(job.skills)];
  return searchableValues.some((value) => String(value || "").toLowerCase().includes(term));
}

export function summarizeRatings(reviews = []) {
  const valid = reviews.filter((item) => Number.isFinite(Number(item.rating))
    && Number(item.rating) >= 1 && Number(item.rating) <= 5);
  const total = valid.reduce((sum, item) => sum + Number(item.rating), 0);
  return {
    count: valid.length,
    average: valid.length ? total / valid.length : null
  };
}
