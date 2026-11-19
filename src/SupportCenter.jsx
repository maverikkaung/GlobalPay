import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase.js";
import { useAuth } from "./useAuth.js";
import DashboardNav from "./DashboardNav.jsx";
import { getRequestErrorMessage } from "./request-errors.js";

const categories = ["account", "technical", "safety", "billing_question", "other"];

function SupportCenter() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("technical");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeRef = useRef(true);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const result = await supabase.from("support_cases")
      .select("id, subject, description, category, status, priority, created_at, updated_at")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!activeRef.current) return;
    if (result.error) setError(getRequestErrorMessage("Unable to load your support requests", result.error));
    else { setCases(result.data || []); setError(""); }
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    activeRef.current = true;
    let active = true;
    const timer = window.setTimeout(() => loadCases().catch((loadError) => {
      if (!active) return;
      setError(getRequestErrorMessage("Unable to load your support requests", loadError));
      setLoading(false);
    }), 0);
    return () => { active = false; activeRef.current = false; window.clearTimeout(timer); };
  }, [loadCases]);

  async function submitCase(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await supabase.from("support_cases").insert({
        requester_id: user.id,
        subject: subject.trim(),
        description: description.trim(),
        category
      }).select("id").single();
      if (result.error) {
        setError(getRequestErrorMessage("Unable to open your support request", result.error));
        return;
      }
      setSubject(""); setDescription(""); setCategory("technical");
      setNotice("Your private support request was submitted.");
      try { await loadCases(); }
      catch { setError("Your request was submitted, but the history could not refresh. Please try loading it again."); }
    } catch (submitError) {
      setError(getRequestErrorMessage("Unable to open your support request", submitError));
    } finally {
      setBusy(false);
    }
  }

  return <div className="dashboard-page account-settings-page">
    <DashboardNav user={user} />
    <main className="dashboard-container account-settings-container support-center-page">
      <header className="dashboard-welcome"><span className="dashboard-tag">HELP & SAFETY</span><h1>Customer Support</h1><p>Contact the TechKarvo team. Your requests are private to you and authorized support staff.</p><Link className="secondary-btn" to="/account-settings">Back to Account Settings</Link></header>
      {error && <p className="account-settings-alert account-settings-alert--error" role="alert">{error}<button type="button" onClick={loadCases}>Retry</button></p>}
      {notice && <p className="account-settings-alert account-settings-alert--success" role="status">{notice}</p>}

      <section className="account-settings-card" aria-labelledby="support-request-heading">
        <h2 id="support-request-heading">Open a support request</h2>
        <form className="support-request-form" onSubmit={submitCase}>
          <label htmlFor="support-category">Category</label>
          <select id="support-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select>
          <label htmlFor="support-subject">Subject</label>
          <input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={160} required />
          <label htmlFor="support-description">How can we help?</label>
          <textarea id="support-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={8000} rows={7} required />
          <button className="primary-btn" type="submit" disabled={busy || loading}>{busy ? "Submitting…" : "Submit private request"}</button>
        </form>
        <p className="account-settings-private-note">Do not include passwords, API keys, payment credentials, or other authentication secrets.</p>
      </section>

      <section className="account-settings-card" aria-labelledby="support-history-heading">
        <h2 id="support-history-heading">Your support requests</h2>
        {loading ? <p role="status">Loading your requests…</p> : cases.length ? <div className="support-case-list">{cases.map((item) => <article className="support-case-card" key={item.id}>
          <header><div><span className={`support-case-status support-case-status--${item.status}`}>{item.status.replaceAll("_", " ")}</span><span className="support-case-category">{item.category.replaceAll("_", " ")}</span></div><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time></header>
          <h3>{item.subject}</h3><p>{item.description}</p>
        </article>)}</div> : <p>No support requests yet.</p>}
      </section>
    </main>
  </div>;
}

export default SupportCenter;
