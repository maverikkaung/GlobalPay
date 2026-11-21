import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import DashboardNav from "./DashboardNav.jsx";
import { getRequestErrorMessage } from "./request-errors.js";
import { getEmailVerificationLabel, getEmailVerificationStatus } from "./account-verification.js";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(date);
}

function AccountSettings() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user.email || "");
  const [emailVerificationStatus, setEmailVerificationStatus] = useState("loading");
  const [createdAt, setCreatedAt] = useState(user.createdAt);
  const [nextEmail, setNextEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [blocked, setBlocked] = useState([]);
  const [blockListAvailable, setBlockListAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAccountDetails() {
      let verificationResolved = false;
      try {
        const result = await supabase.auth.getUser();
        if (!active) return;
        if (result.error) {
          setEmailVerificationStatus("unavailable");
          setError(getRequestErrorMessage("Unable to load account details", result.error));
          setLoading(false);
          return;
        }
        const authUser = result.data.user;
        setEmailVerificationStatus(getEmailVerificationStatus(authUser));
        verificationResolved = true;
        setEmail(authUser?.email || user.email || "");
        setCreatedAt(authUser?.created_at || user.createdAt || null);

        const blocks = await supabase.from("user_blocks")
          .select("blocked_id, created_at")
          .eq("blocker_id", user.id)
          .order("created_at", { ascending: false });
        if (!active) return;
        if (blocks.error && !["PGRST205", "42P01"].includes(blocks.error.code)) {
          setError(getRequestErrorMessage("Unable to load your safety list", blocks.error));
        } else if (!blocks.error) {
          setBlockListAvailable(true);
          const blockedIds = (blocks.data || []).map((row) => row.blocked_id);
          if (blockedIds.length) {
            const [freelancers, clients] = await Promise.all([
              supabase.from("freelancer_public_profiles").select("id, full_name").in("id", blockedIds),
              supabase.from("client_public_profiles").select("id, full_name").in("id", blockedIds)
            ]);
            if (!active) return;
            const names = Object.fromEntries([...(freelancers.data || []), ...(clients.data || [])].map((profile) => [profile.id, profile.full_name]));
            setBlocked((blocks.data || []).map((row) => ({ ...row, displayName: names[row.blocked_id] || "TechKarvo member" })));
          } else setBlocked([]);
        }
        setLoading(false);
      } catch (loadError) {
        if (!active) return;
        if (!verificationResolved) setEmailVerificationStatus("unavailable");
        setError(getRequestErrorMessage("Unable to load account details", loadError));
        setLoading(false);
      }
    }
    loadAccountDetails();
    return () => { active = false; };
  }, [user.createdAt, user.email, user.id]);

  function reauthenticate(password) {
    if (!email || !password) throw new Error("Enter your current password to confirm this security change.");
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function changeEmail(event) {
    event.preventDefault();
    const cleanEmail = nextEmail.trim().toLowerCase();
    if (!cleanEmail || cleanEmail === email.toLowerCase()) {
      setError("Enter a different email address.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const verified = await reauthenticate(emailPassword);
      if (verified.error) throw verified.error;
      const changed = await supabase.auth.updateUser({ email: cleanEmail }, {
        emailRedirectTo: `${window.location.origin}/account-settings`
      });
      if (changed.error) throw changed.error;
      setNextEmail(""); setEmailPassword("");
      setNotice("Check your inboxes and follow Supabase’s verification link to complete the email change. Your current email remains active until verification.");
    } catch (changeError) {
      setError(getRequestErrorMessage("Unable to request an email change", changeError));
    } finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (newPassword.length < 8) { setError("Use a password with at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("The new passwords do not match."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const verified = await reauthenticate(currentPassword);
      if (verified.error) throw verified.error;
      const changed = await supabase.auth.updateUser({ password: newPassword });
      if (changed.error) throw changed.error;
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setNotice("Your password has been updated.");
    } catch (changeError) {
      setError(getRequestErrorMessage("Unable to update your password", changeError));
    } finally { setBusy(false); }
  }

  async function sendResetLink() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (result.error) throw result.error;
      setNotice("If this account can receive reset email, a password reset link has been sent.");
    } catch (resetError) {
      setError(getRequestErrorMessage("Unable to request a password reset", resetError));
    } finally { setBusy(false); }
  }

  async function signOutOtherSessions() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await supabase.auth.signOut({ scope: "others" });
      if (result.error) throw result.error;
      setNotice("Other active sessions have been signed out.");
    } catch (sessionError) {
      setError(getRequestErrorMessage("Unable to end other sessions", sessionError));
    } finally { setBusy(false); }
  }

  async function unblock(blockedId) {
    setBusy(true); setError(""); setNotice("");
    const result = await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
    if (result.error) setError(getRequestErrorMessage("Unable to unblock this member", result.error));
    else { setBlocked((current) => current.filter((row) => row.blocked_id !== blockedId)); setNotice("Member unblocked."); }
    setBusy(false);
  }

  const profilePath = user.accountType === "Client" ? "/client-profile" : "/freelancer-profile";

  return <div className="dashboard-page account-settings-page">
    <DashboardNav user={user} />
    <main className="dashboard-container account-settings-container">
      <header className="dashboard-welcome"><span className="dashboard-tag">ACCOUNT & SECURITY</span><h1>Account Settings</h1><p>Manage private sign-in details separately from the profile members can see.</p></header>
      {error && <p className="account-settings-alert account-settings-alert--error" role="alert">{error}</p>}
      {notice && <p className="account-settings-alert account-settings-alert--success" role="status">{notice}</p>}

      <section className="account-settings-card" aria-labelledby="account-overview-heading" aria-busy={loading}>
        <div><span className="dashboard-tag">PRIVATE ACCOUNT DETAILS</span><h2 id="account-overview-heading">Account information</h2></div>
        {loading ? <p role="status">Loading account details…</p> : <dl className="account-details-grid">
          <div><dt>Name</dt><dd>{user.name || "TechKarvo member"}</dd></div>
          <div><dt>Email</dt><dd>{email || "Not available"}</dd></div>
          <div><dt>Email status</dt><dd>{getEmailVerificationLabel(emailVerificationStatus)}</dd></div>
          <div><dt>Account type</dt><dd>{user.accountType}</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(createdAt)}</dd></div>
        </dl>}
        <p className="account-settings-private-note">Your email and authentication details are private and do not appear on your public profile.</p>
        <Link className="secondary-btn" to={profilePath}>Edit public profile</Link>
      </section>

      <section className="account-settings-card" aria-labelledby="change-email-heading">
        <h2 id="change-email-heading">Change email address</h2>
        <p>We’ll use Supabase Auth verification. Your current email stays active until you confirm the change.</p>
        <form className="account-settings-form" onSubmit={changeEmail}>
          <label htmlFor="settings-new-email">New email</label><input id="settings-new-email" type="email" autoComplete="email" required value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} />
          <label htmlFor="settings-email-password">Current password</label><input id="settings-email-password" type="password" autoComplete="current-password" required value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} />
          <button className="primary-btn" type="submit" disabled={busy || loading}>{busy ? "Please wait…" : "Request verified email change"}</button>
        </form>
      </section>

      <section className="account-settings-card" aria-labelledby="password-heading">
        <h2 id="password-heading">Password & sessions</h2>
        <form className="account-settings-form" onSubmit={changePassword}>
          <label htmlFor="settings-current-password">Current password</label><input id="settings-current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <label htmlFor="settings-new-password">New password</label><input id="settings-new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <label htmlFor="settings-confirm-password">Confirm new password</label><input id="settings-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <button className="primary-btn" type="submit" disabled={busy || loading}>{busy ? "Please wait…" : "Change password"}</button>
        </form>
        <div className="account-settings-secondary-actions"><button type="button" disabled={busy || !email} onClick={sendResetLink}>Send password reset link</button><button type="button" disabled={busy} onClick={signOutOtherSessions}>Sign out other sessions</button></div>
      </section>

      <section className="account-settings-card" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">Privacy & blocked members</h2>
        <p>Public profile information is managed on your profile page. Email and login credentials remain private.</p>
        {!blockListAvailable ? <p className="account-settings-pending">Blocked-member controls need the reviewed staging safety migration before they can be enabled.</p>
          : blocked.length ? <ul className="account-block-list">{blocked.map((row) => <li key={row.blocked_id}><span>{row.displayName}</span><button type="button" disabled={busy} onClick={() => unblock(row.blocked_id)}>Unblock</button></li>)}</ul>
            : <p>No blocked members.</p>}
      </section>

      <section className="account-settings-card" aria-labelledby="support-heading">
        <h2 id="support-heading">Help & support</h2>
        <p>Open a private support request or review a request you have already submitted.</p>
        <Link className="secondary-btn" to="/support">Go to Customer Support</Link>
      </section>
    </main>
  </div>;
}

export default AccountSettings;
