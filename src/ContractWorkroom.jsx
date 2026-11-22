import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./useAuth.js";
import { JobJourney, JobState } from "./JobJourney.jsx";
import ContractDeliveries from "./ContractDeliveries.jsx";
import { isCompletedReviewContext } from "./delivery-workflow.js";
import { buildContractTimeline, contractStates, isContractParticipant, matchesContractContext, milestoneStates } from "./contract-workroom.js";
import "./ContractWorkroom.css";

async function optional(query) {
  try {
    const { data, error } = await query;
    return error ? null : data;
  } catch { return null; }
}

async function readWorkroom(id, userId) {
  const { data: contract, error } = await supabase.from("contracts")
    .select("id,application_id,job_id,client_id,freelancer_id,status,created_at,completed_at")
    .eq("id", id).or(`client_id.eq.${userId},freelancer_id.eq.${userId}`).maybeSingle();
  if (error && !["22P02", "42501"].includes(error.code)) throw error;
  if (error || contract?.id !== id || !isContractParticipant(contract, userId)) return null;

  const [application, job, client, freelancer, thread, milestones] = await Promise.all([
    optional(supabase.from("job_applications").select("id,job_id,client_id,freelancer_id,status,applied_at").eq("id", contract.application_id).maybeSingle()),
    optional(supabase.from("jobs").select("id,title,status").eq("id", contract.job_id).maybeSingle()),
    optional(supabase.from("client_public_profiles").select("full_name").eq("id", contract.client_id).maybeSingle()),
    optional(supabase.from("freelancer_public_profiles").select("full_name,professional_title").eq("id", contract.freelancer_id).maybeSingle()),
    optional(supabase.from("conversations").select("id,application_id,job_id,client_id,freelancer_id")
      .eq("application_id", String(contract.application_id)).maybeSingle()),
    optional(supabase.from("contract_milestones").select("id,title,amount_kav,status").eq("contract_id", contract.id)
      .order("created_at", { ascending: false }).order("id").limit(50))
  ]);
  const events = milestones?.length ? await optional(supabase.from("milestone_events").select("id,milestone_id,event_type,created_at")
    .in("milestone_id", milestones.map(({ id: milestoneId }) => milestoneId))
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30)) : [];
  return { contract, job, client, freelancer, milestones, events,
    application: matchesContractContext(application, contract) && application.id === contract.application_id ? application : null,
    thread: matchesContractContext(thread, contract) && thread.application_id === String(contract.application_id) ? thread : null
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Overview({ data, userId }) {
  const { contract, job, client, freelancer, application, thread, milestones, events } = data;
  const [status, description] = contractStates[contract.status] || ["Status unavailable", "Check again later for the contract status."];
  const timeline = buildContractTimeline(contract, milestones || [], events || []);
  return <>
    <header className="workroom-header journey-panel">
      <p className="journey-muted">Contract workroom</p>
      <h1>{job?.title || "Contract overview"}</h1>
      <p><strong className="workroom-badge">{status}</strong> {description}</p>
      <nav className="journey-actions" aria-label="Contract links">
        {thread && <Link className="journey-button" to={`/messages?conversation=${encodeURIComponent(thread.id)}`}>Related Messages</Link>}
        {job && <Link className="journey-button journey-secondary" to={`/jobs/${encodeURIComponent(contract.job_id)}`}>Related Job</Link>}
        {isCompletedReviewContext(contract, application, job, userId) && <Link className="journey-button journey-secondary"
          to={`/reviews?contract=${encodeURIComponent(contract.id)}`}>Review this project</Link>}
        {["active", "disputed"].includes(contract.status) && <Link className="journey-button journey-secondary"
          to={`/financial-sandbox?contract=${encodeURIComponent(contract.id)}#milestones`}>Milestone Sandbox</Link>}
      </nav>
      {!thread && <p className="journey-muted">No related conversation is available in this workroom. Use the application’s existing Message action to start a conversation when permitted.</p>}
    </header>
    <div className="workroom-grid">
      <section className="journey-panel workroom-section" aria-labelledby="workroom-people">
        <h2 id="workroom-people">Participants and application</h2>
        <dl><dt>Client</dt><dd>{client?.full_name || "Profile unavailable"}</dd>
          <dt>Freelancer</dt><dd><span>{freelancer?.full_name || "Profile unavailable"}</span>{freelancer?.professional_title && <small>{freelancer.professional_title}</small>}</dd>
          <dt>Application</dt><dd>{application?.status || "Unavailable"}</dd>
          {application?.applied_at && <><dt>Applied</dt><dd><time dateTime={application.applied_at}>{formatDate(application.applied_at)}</time></dd></>}
          <dt>Job posting</dt><dd>{job ? (job.status === "open" ? "Open" : "Closed") : "Unavailable"}</dd>
        </dl>
      </section>
      <section id="workroom-milestones" className="journey-panel workroom-section" aria-labelledby="workroom-payment">
        <h2 id="workroom-payment">Milestones and payment status</h2>
        <p><strong className="workroom-badge">Simulated only</strong> KAV is a sandbox unit. TechKarvo does not hold, settle or pay out real funds through this workroom.</p>
        {milestones === null ? <p>Milestone data is unavailable.</p> : !milestones.length ? <p>No sandbox milestones yet.</p> : <ul className="workroom-list">
          {milestones.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{milestoneStates[item.status] || "Status unavailable"}</span><span>{Number(item.amount_kav).toFixed(2)} simulated KAV</span></li>)}
        </ul>}
        {milestones?.length === 50 && <p>Showing the latest 50 milestones.</p>}
      </section>
    </div>
    <ContractDeliveries key={`${contract.id}:${userId}`} contract={contract} userId={userId} />
    <section className="journey-panel workroom-section" aria-labelledby="workroom-activity">
      <h2 id="workroom-activity">Recent activity</h2>
      {events === null && <p>Milestone activity is unavailable. Contract dates are shown below.</p>}
      {timeline.length ? <ol className="workroom-list">{timeline.map((item) => <li key={item.id}><strong>{item.label}</strong>
        <time dateTime={item.at}>{formatDate(item.at)}</time></li>)}</ol> : <p>No recorded activity.</p>}
    </section>
  </>;
}

export default function ContractWorkroom() {
  const id = useParams().id.toLowerCase();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const userId = user?.id;
  const key = `${id}:${userId}:${attempt}`;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    readWorkroom(id, userId).then((data) => { if (live) setResult({ key, data }); }, () => {
      if (live) setResult({ key, error: true });
    });
    return () => { live = false; };
  }, [id, key, userId]);
  const current = result?.key === key ? result : null;
  return <JobJourney user={user}>
    <Link className="journey-back" to={user?.accountType === "Client" ? "/my-projects" : "/my-applications"}>Back to your work</Link>
    {!current ? <JobState title="Loading contract" status="loading" />
      : current.error ? <JobState title="Could not load the workroom" status="error" onRetry={() => setAttempt((count) => count + 1)} />
      : !current.data ? <JobState title="Contract unavailable">This contract does not exist or is not available to your account.</JobState>
      : <Overview data={current.data} userId={userId} />}
  </JobJourney>;
}
