import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { getRequestErrorMessage } from "./request-errors.js";

export default function MemberSafetyActions({ user, memberId, memberName, applicationId = null, onBlockedChange }) {
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [category, setCategory] = useState("harassment");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSafetyState() {
      const [blockResult, muteResult] = await Promise.all([
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", memberId).maybeSingle(),
        supabase.from("muted_users").select("muted_user_id").eq("user_id", user.id).eq("muted_user_id", memberId).maybeSingle()
      ]);
      if (!active) return;
      const schemaMissing = [blockResult.error, muteResult.error].some((item) => ["PGRST205", "42P01"].includes(item?.code));
      if (schemaMissing) { setAvailable(false); setLoading(false); return; }
      if (!schemaMissing && (blockResult.error || muteResult.error)) setError("Safety controls could not be loaded.");
      const nextBlocked = Boolean(blockResult.data);
      setBlocked(nextBlocked); setMuted(Boolean(muteResult.data)); onBlockedChange?.(nextBlocked);
      setLoading(false);
    }
    loadSafetyState().catch((loadError) => {
      if (active) { setError(getRequestErrorMessage("Safety controls could not be loaded", loadError)); setLoading(false); }
    });
    return () => { active = false; };
  }, [memberId, onBlockedChange, user.id]);

  async function toggleBlock() {
    if (!blocked && !window.confirm(`Block ${memberName || "this member"}? Their social posts and personal messages will be hidden. Existing job conversations remain available; active contract rules may prevent blocking.`)) return;
    setBusy(true); setError(""); setNotice("");
    const result = blocked
      ? await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", memberId)
      : await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: memberId });
    if (result.error) {
      if (!blocked && result.error.code === "42501") {
        setError("This member cannot be blocked while an active contract or accepted open job exists.");
      } else {
        setError(getRequestErrorMessage(blocked ? "Unable to unblock this member" : "Unable to block this member", result.error));
      }
    }
    else {
      const next = !blocked; setBlocked(next); onBlockedChange?.(next);
      setNotice(next ? "Member blocked. Job-related conversations remain available." : "Member unblocked.");
    }
    setBusy(false);
  }

  async function toggleMute() {
    setBusy(true); setError(""); setNotice("");
    const result = muted
      ? await supabase.from("muted_users").delete().eq("user_id", user.id).eq("muted_user_id", memberId)
      : await supabase.from("muted_users").insert({ user_id: user.id, muted_user_id: memberId });
    if (result.error) setError(getRequestErrorMessage(muted ? "Unable to unmute this member" : "Unable to mute this member", result.error));
    else { setMuted(!muted); setNotice(muted ? "Member unmuted." : "Their posts are muted in your feed."); }
    setBusy(false);
  }

  async function submitReport(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const result = await supabase.from("user_reports").insert({
      reporter_id: user.id, reported_user_id: memberId, category, details: details.trim(), application_id: applicationId || null
    });
    if (result.error) setError(getRequestErrorMessage("Unable to send this report", result.error));
    else { setDetails(""); setReportOpen(false); setNotice("Report sent to TechKarvo support for review."); }
    setBusy(false);
  }

  if (loading) return <div className="member-safety-actions" role="status">Loading safety controls…</div>;
  if (!available) return <p className="member-safety-pending" role="note">Member safety controls are waiting for the reviewed staging migration.</p>;

  return <section className="member-safety-actions" aria-label={`Safety controls for ${memberName || "member"}`}>
    <div className="member-safety-buttons">
      <button type="button" disabled={busy} onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
      <button type="button" disabled={busy} onClick={toggleBlock}>{blocked ? "Unblock" : "Block"}</button>
      <button type="button" disabled={busy} onClick={() => setReportOpen((open) => !open)}>{reportOpen ? "Close report" : "Report"}</button>
    </div>
    {reportOpen && <form className="member-report-form" onSubmit={submitReport}>
      <label htmlFor={`report-category-${memberId}`}>Reason</label>
      <select id={`report-category-${memberId}`} value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="harassment">Harassment</option><option value="fraud">Fraud or unsafe behavior</option><option value="spam">Spam</option><option value="safety">Safety concern</option><option value="other">Other</option>
      </select>
      <label htmlFor={`report-details-${memberId}`}>Details (optional)</label>
      <textarea id={`report-details-${memberId}`} maxLength={4000} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe what happened. Avoid sharing passwords or payment details." />
      <button type="submit" className="primary-btn" disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
    </form>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
