import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { useJob } from "./useJob.js";
import { formatJobBudget, jobJourneyPath } from "./job-discovery.js";
import { JobBackLink, JobJourney, JobSkills, JobState } from "./JobJourney.jsx";

export default function JobDetails() {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const { status, job } = useJob(id, user?.id, attempt, true);
  const open = job?.status === "open";
  const canApply = !user || user.accountType === "Freelancer";

  return <JobJourney user={user}>
    <JobBackLink />
    {status === "loading" && <JobState title="Loading job details" status="loading">Fetching the project…</JobState>}
    {status === "missing" && <JobState title="Job unavailable">This posting may have been removed or may no longer be visible to you.</JobState>}
    {status === "error" && <JobState title="We couldn’t load this job" status="error" onRetry={() => setAttempt((value) => value + 1)}>
      Your search is saved. Try loading the same job again.
    </JobState>}
    {job && <div className="journey-detail journey-job-overview">
      <header className="journey-panel journey-detail-intro">
        <p className="journey-card-meta"><span>{job.category || "Other"}</span><span>{open ? "Accepting applications" : "Closed"}</span></p>
        <h1>{job.title}</h1>
        <p className="journey-muted">
          {job.company ? <Link to={"/profiles/" + job.clientId}>{job.company}</Link> : "TechKarvo client"}
        </p>
      </header>
      <aside className="journey-panel journey-summary" aria-label="Project terms">
        <h2>Project terms</h2>
        <dl><dt>Budget</dt><dd>{formatJobBudget(job)}</dd>
          {job.paymentType && <><dt>Payment type</dt><dd>{job.paymentType}</dd></>}
        </dl>
        {!open ? <p role="status">This job is closed and no longer accepting applications.</p>
          : canApply ? <button className="journey-button" type="button"
            onClick={() => navigate(jobJourneyPath("/apply/" + job.id, search))}>Apply for This Job</button>
          : <p>Applications are available to freelancer accounts.</p>}
        {user?.id && user.id === job.clientId && <Link className="journey-button journey-secondary" to="/my-projects">Manage project</Link>}
      </aside>
      <article className="journey-panel journey-job-detail">
        <h2>About this project</h2>
        <p className="journey-detail-description">{job.description}</p>
        {job.skills.length > 0 && <><h2>Required skills</h2><JobSkills skills={job.skills} /></>}
      </article>
    </div>}
  </JobJourney>;
}
