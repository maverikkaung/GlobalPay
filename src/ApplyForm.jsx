import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { useJob } from "./useJob.js";
import { formatJobBudget } from "./job-discovery.js";
import { JobBackLink, JobJourney, JobState } from "./JobJourney.jsx";
import { getMarketplaceWriteError } from "./marketplace-write-errors.js";
import { availableApplicationQuota, buildProposal, EXPERIENCE_LEVELS, RATE_TYPES, validateProposal } from "./proposal.js";

const profileFields = {
  fullName: "full_name", country: "country", title: "professional_title", bio: "bio",
  skills: "skills", experience: "experience", portfolio: "portfolio_url"
};

async function loadQuota(userId) {
  const entitlement = await supabase.from("membership_entitlements")
    .select("plan_id,period_credit_limit,credits_used,period_started_at,period_ends_at").eq("user_id", userId).maybeSingle();
  if (entitlement.error || !entitlement.data) return null;
  const plan = await supabase.from("membership_plans")
    .select("id,account_type,is_active,is_simulation_only,included_usage_credits").eq("id", entitlement.data.plan_id).maybeSingle();
  return availableApplicationQuota(entitlement.data, plan.error ? null : plan.data);
}

async function checkExistingProposal(jobId, userId) {
  const { data, error } = await supabase.from("job_applications").select("id")
    .eq("job_id", jobId).eq("freelancer_id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

function ProposalField({ field, label, draft, errors, onEdit, type = "text", choices, optional = false, help }) {
  const id = "application-" + field;
  const error = errors[field];
  const props = { id, name: field, value: draft[field], required: !optional, onChange: (event) => onEdit(field, event.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [help && id + "-help", error && id + "-error"].filter(Boolean).join(" ") || undefined };

  return <div className="journey-field">
    <label htmlFor={id}>{label}{optional && <span className="journey-muted"> (optional)</span>}</label>
    {help && <p className="journey-muted" id={id + "-help"}>{help}</p>}
    {choices ? <select {...props}>
      {field === "experience" && <option value="">Select experience</option>}
      {choices.map((choice) => <option key={choice}>{choice}</option>)}
    </select> : type === "textarea" ? <textarea {...props} rows={field === "coverLetter" ? 6 : 3} />
      : <input {...props} type={type} {...(type === "number" ? { min: "0.01", step: "any", inputMode: "decimal" } : {})} />}
    {error && <p className="journey-error" id={id + "-error"}>{error}</p>}
  </div>;
}

function ProposalEditor({ job, user }) {
  const [draft, setDraft] = useState({
    fullName: user.name || "", country: "", title: "", bio: "", skills: "", experience: "",
    coverLetter: "", salary: "", salaryType: RATE_TYPES.includes(job.paymentType) ? job.paymentType : "Fixed Price", portfolio: ""
  });
  const [quota, setQuota] = useState(null);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const touched = useRef(new Set());
  const submissionLock = useRef(false);
  const feedbackFocus = useRef(null);
  const email = user.email || "";

  useEffect(() => {
    let active = true;
    supabase.from("profiles").select(Object.values(profileFields).join(",")).eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        const untouched = Object.fromEntries(Object.entries(profileFields)
          .filter(([field, column]) => data[column] && !touched.current.has(field))
          .map(([field, column]) => [field, data[column]]));
        setDraft((current) => ({ ...current, ...untouched }));
      }, () => {});
    loadQuota(user.id).then((value) => { if (active) setQuota(value); }, () => {});
    checkExistingProposal(job.id, user.id).then((exists) => {
      if (active && exists) setFeedback((current) => current || {
        type: "duplicate", message: "You've already applied for this job. Check the application status before taking another action."
      });
    }, () => {});
    return () => { active = false; };
  }, [job.id, user.id]);

  useEffect(() => {
    if (feedback) feedbackFocus.current?.focus();
  }, [feedback]);

  function edit(field, value) {
    touched.current.add(field);
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function alreadyApplied() {
    setFeedback({ type: "duplicate", message: "You've already applied for this job. View your application and its status." });
  }

  async function submit(event) {
    event.preventDefault();
    if (submissionLock.current || ["success", "duplicate", "closed"].includes(feedback?.type)) return;

    const validation = validateProposal(draft);
    setErrors(validation);
    if (Object.keys(validation).length || !email.trim()) {
      setFeedback({ type: "error", message: !email.trim() ? "Your account email could not be confirmed. Check your account before submitting."
        : "Review the highlighted fields and try again." });
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    setFeedback(null);
    try {
      if (await checkExistingProposal(job.id, user.id)) {
        alreadyApplied();
        return;
      }

      const result = await supabase.from("job_applications").insert(buildProposal(draft, user, job));
      if (result.error?.code === "23505") {
        alreadyApplied();
      } else if (result.error?.code === "42501") {
        const { data, error } = await supabase.from("jobs").select("status").eq("id", job.id).maybeSingle();
        setFeedback(!error && data?.status !== "open"
          ? { type: "closed", message: "This job closed or became unavailable before your proposal could be submitted." }
          : { type: "error", message: "Your account could not submit this proposal. Check your access and try again." });
      } else if (result.error && (!result.status || result.status >= 500)) {
        throw result.error;
      } else if (result.error) {
        setFeedback({
          type: "error", message: getMarketplaceWriteError(result.error, "We couldn’t submit your application", "application")
        });
      } else {
        setFeedback({ type: "success", message: "Application submitted." });
        loadQuota(user.id).then(setQuota, () => {});
      }
    } catch {
      const exists = await checkExistingProposal(job.id, user.id).catch(() => false);
      if (exists) alreadyApplied();
      else setFeedback({ type: "error", message: "We couldn’t confirm submission. Your proposal is still here. Try again to check for an existing application before submitting." });
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  const field = { draft, errors, onEdit: edit };
  const finished = ["duplicate", "success", "closed"].includes(feedback?.type);
  return <>
    <header className="journey-proposal-heading"><p className="journey-muted">Job proposal</p><h1>Apply for {job.title}</h1></header>
    <div className="journey-detail journey-proposal">
      <aside className="journey-panel journey-summary" aria-label="Application summary">
        <h2>Application summary</h2>
        <dl><dt>Job budget</dt><dd>{formatJobBudget(job)}</dd></dl>
        <div aria-live="polite">
          <p className="journey-budget">{quota ? quota.remaining + " applications remaining" : "Application allowance"}</p>
          <p className="journey-muted">
            {quota ? "Current cycle ends " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(quota.ends) + " (UTC)." : "Your current allowance will be checked when you submit."}
          </p>
        </div>
      </aside>
      <form className="journey-panel journey-proposal-form" onSubmit={submit} noValidate aria-busy={submitting}>
        {feedback && <div className={"journey-feedback " + (feedback.type === "success" ? "journey-success" : "journey-error")}
          ref={feedbackFocus} tabIndex={-1} role={feedback.type === "success" ? "status" : "alert"}>
          <p>{feedback.message}</p>
          {["duplicate", "success"].includes(feedback.type) && <Link to="/my-applications">View your applications</Link>}
        </div>}
        {feedback?.type !== "success" && <>
          <fieldset className="journey-fieldset" disabled={submitting || finished}>
            <legend>Contact details</legend>
            <div className="journey-field-grid">
              <ProposalField {...field} field="fullName" label="Full Name" />
              <ProposalField {...field} field="country" label="Country / City" />
            </div>
            <div className="journey-field">
              <label htmlFor="application-email">Email Address</label>
              <p id="application-email-help" className="journey-muted">This account email is shared with the hiring client in your application.</p>
              <input id="application-email" type="email" value={email} readOnly aria-describedby="application-email-help" />
            </div>
          </fieldset>
          <fieldset className="journey-fieldset" disabled={submitting || finished}>
            <legend>Professional profile</legend>
            <div className="journey-field-grid">
              <ProposalField {...field} field="title" label="Professional Title" />
              <ProposalField {...field} field="experience" label="Years of Experience" choices={EXPERIENCE_LEVELS} />
            </div>
            <ProposalField {...field} field="bio" label="About Me" type="textarea" />
            <ProposalField {...field} field="skills" label="Skills" help="Separate skills with commas." />
            <ProposalField {...field} field="portfolio" label="Portfolio URL" type="url" optional />
          </fieldset>
          <fieldset className="journey-fieldset" disabled={submitting || finished}>
            <legend>Your proposal</legend>
            <ProposalField {...field} field="coverLetter" label="Cover Letter" type="textarea"
              help="Explain how you would approach this specific project." />
            <div className="journey-field-grid">
              <ProposalField {...field} field="salary" label="Expected Salary (USD)" type="number"
                help={draft.salaryType === "Hourly" ? "USD per hour." : "Total project amount in USD."} />
              <ProposalField {...field} field="salaryType" label="Salary Type" choices={RATE_TYPES} />
            </div>
          </fieldset>
          <div className="journey-form-actions">
            <button className="journey-button" type="submit" disabled={submitting || finished}>
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
            {submitting && <span role="status">Checking and sending your proposal…</span>}
          </div>
        </>}
      </form>
    </div>
  </>;
}

function ProposalPage({ id, user }) {
  const [attempt, setAttempt] = useState(0);
  const { status, job } = useJob(id, user.id, attempt);
  return <JobJourney user={user}>
    <JobBackLink path={"/jobs/" + id}>Back to Job Details</JobBackLink>
    {status === "loading" && <JobState title="Loading application" status="loading">Fetching the job posting…</JobState>}
    {status === "error" && <JobState title="We couldn’t open the application" status="error" onRetry={() => setAttempt((value) => value + 1)}>
      The job could not be loaded. Try again before entering a proposal.
    </JobState>}
    {status === "missing" && <JobState title="Job unavailable">This posting may have been removed or may no longer be visible to you.</JobState>}
    {job && (job.status === "open" ? <ProposalEditor job={job} user={user} />
      : <JobState title="Applications closed">This job is no longer accepting applications.</JobState>)}
  </JobJourney>;
}

export default function ApplyForm() {
  const { id } = useParams();
  const { user } = useAuth();
  if (user?.accountType !== "Freelancer" || !user.id) {
    return <JobJourney user={user}>
      <JobBackLink />
      <JobState title="Freelancer account required">Sign in with a freelancer account to apply.</JobState>
    </JobJourney>;
  }
  return <ProposalPage key={user.id + ":" + id} id={id} user={user} />;
}
