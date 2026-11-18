function searchable(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

export function filterApplicants(applications, filters = {}, profiles = {}) {
  const query = searchable(filters.query).split(/\s+/).filter(Boolean);
  return applications.filter((application) => {
    if (filters.jobId && filters.jobId !== "all" && String(application.job_id) !== String(filters.jobId)) return false;
    if (filters.status && filters.status !== "all" && application.status !== filters.status) return false;
    if (!query) return true;
    const profile = profiles[application.freelancer_id] || {};
    const values = [
      profile.full_name || application.full_name,
      profile.professional_title || application.professional_title,
      profile.country || application.country,
      profile.skills || application.skills,
      profile.bio || application.bio,
      application.job_title,
      application.cover_letter
    ];
    const haystack = values.map(searchable).join(" ");
    return query.every((term) => haystack.includes(term));
  });
}

export function sortApplicants(applications, sortBy = "recent", ratings = {}) {
  const sorted = [...applications];
  const date = (item) => Date.parse(item.applied_at || "") || 0;
  const budget = (item) => Number(item.expected_salary) || 0;
  const rating = (item) => ratings[item.freelancer_id]?.average ?? 0;

  if (sortBy === "oldest") return sorted.sort((a, b) => date(a) - date(b));
  if (sortBy === "budget-high") return sorted.sort((a, b) => budget(b) - budget(a) || date(b) - date(a));
  if (sortBy === "rating-high") return sorted.sort((a, b) => rating(b) - rating(a) || date(b) - date(a));
  return sorted.sort((a, b) => date(b) - date(a));
}
