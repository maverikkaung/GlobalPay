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
    return counts;
  }, { accepted: 0, pending: 0, rejected: 0 });
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

export function summarizeRatings(reviews = []) {
  const valid = reviews.filter((item) => Number.isFinite(Number(item.rating))
    && Number(item.rating) >= 1 && Number(item.rating) <= 5);
  const total = valid.reduce((sum, item) => sum + Number(item.rating), 0);
  return {
    count: valid.length,
    average: valid.length ? total / valid.length : null
  };
}
