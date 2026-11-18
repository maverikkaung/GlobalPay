import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getRequestErrorMessage } from "./request-errors.js";
import DashboardNav from "./DashboardNav.jsx";

function ClientProfile() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const userId = user?.id;
  const userName = user?.name;
  const accountType = user?.accountType;
  const [fullName, setFullName] = useState(user?.name || "");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return undefined;
    }
    if (accountType !== "Client") {
      navigate("/freelancer-dashboard");
      return undefined;
    }

    let active = true;
    supabase.from("profiles").select("full_name, country")
      .eq("id", userId).maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(getRequestErrorMessage("Unable to load your profile", loadError));
        else if (data) {
          setFullName(data.full_name || userName || "");
          setCountry(data.country || "");
        }
        setLoading(false);
      }).catch((loadError) => {
        if (!active) return;
        setError(getRequestErrorMessage("Unable to load your profile", loadError));
        setLoading(false);
      });
    return () => { active = false; };
  }, [accountType, navigate, userId, userName]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        country: country.trim()
      }).eq("id", userId).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Your profile record was not found. Please sign out and back in.");
      refreshProfile();
      setNotice("Your profile has been saved.");
    } catch (saveError) {
      setError(getRequestErrorMessage("Unable to save your profile", saveError));
    } finally {
      setSaving(false);
    }
  }

  if (!userId || accountType !== "Client") return null;

  return (
    <div className="dashboard-page">
      <DashboardNav user={user} />
      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">CLIENT PROFILE</span>
          <h1>My Public Profile</h1>
          <p>Keep your identity up to date for freelancers you work with.</p>
        </div>
        <form className="application-form" onSubmit={saveProfile}>
          {error && <p role="alert">{error}</p>}
          {notice && <p className="auth-notice auth-notice--success" role="status">{notice}</p>}
          <label htmlFor="client-profile-name">Full name</label>
          <input id="client-profile-name" maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <label htmlFor="client-profile-country">Country / City</label>
          <input id="client-profile-country" maxLength={120} required placeholder="Example: Yangon, Myanmar" value={country} onChange={(event) => setCountry(event.target.value)} />
          <button type="submit" className="primary-btn" disabled={saving || loading}>
            {loading ? "Loading profile…" : saving ? "Saving…" : "Save profile"}
          </button>
        </form>
        <p><Link to={`/profiles/${userId}`}>Preview your public profile ↗</Link></p>
      </main>
    </div>
  );
}

export default ClientProfile;
