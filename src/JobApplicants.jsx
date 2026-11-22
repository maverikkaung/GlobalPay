import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getRequestErrorMessage } from "./request-errors.js";
import { parseSkills, summarizeRatings } from "./marketplace.js";
import { filterApplicants, sortApplicants } from "./applicant-list.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";
import DashboardNav from "./DashboardNav.jsx";

function ApplicantCard({ application, profile, portfolio, rating, busy, onDecision }) {
  const displayName = profile?.full_name || application.full_name || "Freelancer";
  const title = profile?.professional_title || application.professional_title || "Independent professional";
  const skills = parseSkills(profile?.skills || application.skills);
  const avatarUrl = toSafeExternalUrl(profile?.avatar_url)
    || (profile?.avatar_path
      ? toSafeExternalUrl(supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(profile.avatar_path).data?.publicUrl)
      : "");
  const appliedDate = application.applied_at
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(application.applied_at))
    : "Date unavailable";
  const amount = Number(application.expected_salary);
  const budget = Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
    : "Budget not provided";
  const status = application.status || "Pending";

  return (
    <article className="applicant-card">
      <header className="applicant-card-header">
        <div className="applicant-identity">
          {avatarUrl
            ? <img className="applicant-avatar" src={avatarUrl} alt={`${displayName} profile`} loading="lazy" />
            : <span className="applicant-avatar applicant-avatar-fallback" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>}
          <div className="applicant-name-block">
            <h2>{displayName}</h2>
            <p className="applicant-title">{title}</p>
            <p className="applicant-location">{profile?.country || application.country || "Location not provided"}</p>
          </div>
        </div>
        <span className={`applicant-status applicant-status--${status.toLowerCase()}`}>{status}</span>
      </header>

      <div className="applicant-rating" aria-label={rating.count
        ? `Verified average rating ${rating.average.toFixed(1)} out of 5 from ${rating.count} completed project reviews`
        : "No verified completed project reviews yet"}>
        <strong>{rating.average === null ? "New" : `★ ${rating.average.toFixed(1)}`}</strong>
        {rating.count > 0 ? <span>{rating.count} verified {rating.count === 1 ? "review" : "reviews"}</span> : <span>No verified reviews yet</span>}
      </div>

      <div className="applicant-job-summary">
        <span className="applicant-eyebrow">Applied for</span>
        <strong>{application.job_title || "Job no longer available"}</strong>
        <div className="applicant-meta"><span>{budget}{application.salary_type ? ` · ${application.salary_type}` : ""}</span><time dateTime={application.applied_at || undefined}>Applied {appliedDate}</time></div>
      </div>

      {skills.length > 0 && <div className="applicant-skills" aria-label="Freelancer skills">
        {skills.slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}
        {skills.length > 8 && <span>+{skills.length - 8}</span>}
      </div>}

      {(profile?.bio || application.bio) && <p className="applicant-summary">{profile?.bio || application.bio}</p>}

      {portfolio.length > 0 && <section className="applicant-portfolio" aria-label="Portfolio previews">
        <h3>Selected work</h3>
        <div className="applicant-portfolio-grid">
          {portfolio.slice(0, 3).map((item) => {
            const image = toSafeExternalUrl(item.image_url);
            const href = toSafeExternalUrl(item.project_url);
            return <a className="applicant-portfolio-item" key={item.id} href={href || undefined} target={href ? "_blank" : undefined} rel={href ? "noopener noreferrer" : undefined}>
              {image ? <img src={image} alt={`${item.title} portfolio preview`} loading="lazy" /> : <span className="applicant-portfolio-placeholder" aria-hidden="true">TK</span>}
              <span>{item.title}</span>
            </a>;
          })}
        </div>
      </section>}

      <details className="applicant-details">
        <summary>Application details and cover letter</summary>
        <div className="applicant-details-content">
          <div><h3>Cover letter</h3><p>{application.cover_letter?.trim() || "No cover letter was included."}</p></div>
          {application.experience && <div><h3>Experience</h3><p>{application.experience}</p></div>}
          {application.portfolio && <div><h3>Application portfolio link</h3><p><a href={toSafeExternalUrl(application.portfolio) || undefined} target="_blank" rel="noopener noreferrer">View submitted portfolio ↗</a></p></div>}
        </div>
      </details>

      <footer className="applicant-actions">
        <Link className="applicant-action applicant-action--secondary" to={`/profiles/${application.freelancer_id}`}>View Profile</Link>
        {status === "Pending" || status === "Accepted"
          ? <Link className="applicant-action applicant-action--secondary" to={`/messages?application=${encodeURIComponent(application.id)}`}>Message</Link>
          : null}
        {status === "Accepted" && application.contractId && <Link className="applicant-action applicant-action--secondary"
          to={`/contracts/${encodeURIComponent(application.contractId)}`}>Open Contract Workroom</Link>}
        {status === "Pending" && <>
          <button className="applicant-action applicant-action--primary" type="button" disabled={busy} onClick={() => onDecision(application, "Accepted")}>
            {busy ? "Saving…" : "Accept"}
          </button>
          <button className="applicant-action applicant-action--danger" type="button" disabled={busy} onClick={() => onDecision(application, "Rejected")}>
            {busy ? "Saving…" : "Reject"}
          </button>
        </>}
      </footer>
    </article>
  );
}

function JobApplicants() {
  const { user } = useAuth();
  const userId = user?.id;
  const accountType = user?.accountType;
  const [applications, setApplications] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [portfolios, setPortfolios] = useState({});
  const [ratings, setRatings] = useState({});
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");
  const requestId = useRef(0);

  const loadApplications = useCallback(async () => {
    if (accountType !== "Client" || !userId) return;
    const currentRequestId = ++requestId.current;
    try {
      const result = await supabase.from("job_applications")
        .select("id, job_id, client_id, freelancer_id, full_name, country, professional_title, bio, skills, experience, cover_letter, expected_salary, salary_type, portfolio, status, applied_at")
        .eq("client_id", userId).order("applied_at", { ascending: false });
      if (result.error) throw result.error;
      const rows = result.data || [];
      const jobIds = [...new Set(rows.map((item) => item.job_id))];
      const freelancerIds = [...new Set(rows.map((item) => item.freelancer_id))];
      const acceptedIds = rows.filter((item) => item.status === "Accepted").map((item) => item.id);
      const [jobsResult, profilesResult, portfolioResult, reviewsResult, contracts] = await Promise.all([
        jobIds.length ? supabase.from("jobs").select("id, title").in("id", jobIds).eq("client_id", userId) : Promise.resolve({ data: [], error: null }),
        freelancerIds.length ? supabase.from("freelancer_public_profiles")
          .select("*")
          .in("id", freelancerIds) : Promise.resolve({ data: [], error: null }),
        freelancerIds.length ? supabase.from("portfolio_items")
          .select("id, freelancer_id, title, project_url, image_url, created_at")
          .in("freelancer_id", freelancerIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        freelancerIds.length ? supabase.from("reviews_public").select("id, reviewee_id, rating")
          .in("reviewee_id", freelancerIds) : Promise.resolve({ data: [], error: null }),
        acceptedIds.length ? supabase.from("contracts").select("id,application_id").eq("client_id", userId)
          .in("application_id", acceptedIds).then(({ data, error }) => error ? [] : data || [], () => []) : []
      ]);
      for (const extra of [jobsResult, profilesResult, portfolioResult, reviewsResult]) {
        if (extra.error) throw extra.error;
      }
      if (requestId.current !== currentRequestId) return;

      const jobsById = Object.fromEntries((jobsResult.data || []).map((job) => [String(job.id), job.title]));
      const profilesById = Object.fromEntries((profilesResult.data || []).map((profile) => [profile.id, profile]));
      const portfolioById = {};
      for (const item of portfolioResult.data || []) (portfolioById[item.freelancer_id] ||= []).push(item);
      const reviewsById = {};
      for (const item of reviewsResult.data || []) (reviewsById[item.reviewee_id] ||= []).push(item);

      const contractByApplication = new Map(contracts.map((contract) => [contract.application_id, contract.id]));
      setApplications(rows.map((item) => ({ ...item, contractId: contractByApplication.get(item.id),
        job_title: jobsById[String(item.job_id)] || "Job no longer available" })));
      setProfiles(profilesById);
      setPortfolios(portfolioById);
      setRatings(Object.fromEntries(freelancerIds.map((id) => [id, summarizeRatings(reviewsById[id] || [])])));
      setError("");
    } catch (loadError) {
      if (requestId.current === currentRequestId) setError(getRequestErrorMessage("Unable to load applicants", loadError));
    } finally {
      if (requestId.current === currentRequestId) setLoading(false);
    }
  }, [accountType, userId]);

  useEffect(() => {
    const timer = window.setTimeout(loadApplications, 0);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [loadApplications]);

  const jobOptions = useMemo(() => {
    const uniqueJobs = new Map(applications.map((application) => [String(application.job_id), application.job_title]));
    return [...uniqueJobs].map(([id, title]) => ({ id, title }));
  }, [applications]);
  const visibleApplications = useMemo(() => sortApplicants(
    filterApplicants(applications, { query, jobId: jobFilter, status: statusFilter }, profiles), sortBy, ratings
  ), [applications, jobFilter, profiles, query, ratings, sortBy, statusFilter]);

  async function updateStatus(application, newStatus) {
    const decision = newStatus === "Accepted" ? "accept this application and hire this freelancer" : "reject this application";
    if (!window.confirm(`Are you sure you want to ${decision}?`)) return;
    setUpdatingApplicationId(application.id);
    setError("");
    try {
      const result = await supabase.from("job_applications").update({ status: newStatus })
        .eq("id", application.id).eq("client_id", user.id).eq("status", "Pending")
        .select("id, status").single();
      if (result.error) throw result.error;
      setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status: result.data.status } : item));
      if (result.data.status === "Accepted") await loadApplications();
    } catch (updateError) {
      setError(getRequestErrorMessage("Unable to update this application", updateError));
      await loadApplications();
    } finally {
      setUpdatingApplicationId("");
    }
  }

  if (!user) return <div className="dashboard-page"><h2>Please log in first.</h2><Link to="/login">Go to Login</Link></div>;
  if (user.accountType !== "Client") return <div className="dashboard-page"><h2>Only Clients can view applicants.</h2><Link to="/freelancer-dashboard">Back to Dashboard</Link></div>;

  return <div className="dashboard-page">
    <DashboardNav user={user} />
    <main className="dashboard-container applicants-page">
      <header className="dashboard-welcome applicants-welcome">
        <span className="dashboard-tag">CLIENT MANAGEMENT</span>
        <h1>My Applicants</h1>
        <p>Compare each application, review current public profiles, and make a confident hiring decision.</p>
      </header>

      <section className="applicant-toolbar" aria-label="Applicant search and filters">
        <label className="applicant-search"><span>Search applicants</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, skill, title, or job" /></label>
        <label><span>Job</span><select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}><option value="all">All jobs</option>{jobOptions.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
        <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option>Pending</option><option>Accepted</option><option>Rejected</option><option>Withdrawn</option></select></label>
        <label><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="recent">Most recent</option><option value="oldest">Oldest</option><option value="budget-high">Highest budget</option><option value="rating-high">Highest rating</option></select></label>
      </section>

      <div className="applicant-results-heading"><h2>Applications</h2><span>{visibleApplications.length} of {applications.length}</span></div>
      {error && <div className="applicant-error" role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); loadApplications(); }} disabled={loading}>{loading ? "Retrying…" : "Try again"}</button></div>}
      {loading ? <div className="applicant-state" role="status"><span className="applicant-spinner" aria-hidden="true" /><h2>Loading applicants…</h2><p>Gathering applications, profiles, portfolio samples, and verified reviews.</p></div>
        : applications.length === 0 ? <div className="applicant-state"><h2>No applications yet</h2><p>Freelancers who apply to your open jobs will appear here.</p><Link to="/post-job">Post a job</Link></div>
          : visibleApplications.length === 0 ? <div className="applicant-state"><h2>No matching applicants</h2><p>Try adjusting or clearing your search and filters.</p><button type="button" onClick={() => { setQuery(""); setJobFilter("all"); setStatusFilter("all"); }}>Clear filters</button></div>
            : <div className="applicant-grid">{visibleApplications.map((application) => <ApplicantCard
              key={application.id}
              application={application}
              profile={profiles[application.freelancer_id]}
              portfolio={portfolios[application.freelancer_id] || []}
              rating={ratings[application.freelancer_id] || { count: 0, average: null }}
              busy={updatingApplicationId === application.id}
              onDecision={updateStatus}
            />)}</div>}
    </main>
  </div>;
}

export default JobApplicants;
