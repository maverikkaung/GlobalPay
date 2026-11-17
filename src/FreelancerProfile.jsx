import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { toSafeExternalUrl } from "./external-urls.js";

function FreelancerProfile() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const userId = user?.id;
  const userName = user?.name;
  const accountType = user?.accountType;
  const [fullName, setFullName] = useState(user ? user.name : "");
  const [country, setCountry] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }

    if (accountType !== "Freelancer") {
      navigate("/client-dashboard");
      return;
    }

    let active = true;
    supabase.from("profiles")
      .select("full_name, country, professional_title, bio, skills, experience, portfolio_url")
      .eq("id", userId).maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError("Unable to load your profile. " + loadError.message);
        } else if (data) {
          setFullName(data.full_name || userName || "");
          setCountry(data.country || "");
          setTitle(data.professional_title || "");
          setBio(data.bio || "");
          setSkills(data.skills || "");
          setExperience(data.experience || "");
          setPortfolio(data.portfolio_url || "");
        }
        setLoading(false);
      }).catch((loadError) => {
        if (!active) return;
        setError("Unable to load your profile. " + loadError.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [accountType, navigate, userId, userName]);

  async function handleSave(event) {
    event.preventDefault();

    if (!userId) {
      navigate("/login");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");
      const portfolioUrl = portfolio.trim() ? toSafeExternalUrl(portfolio) : null;
      if (portfolio.trim() && !portfolioUrl) {
        throw new Error("Enter a valid portfolio URL starting with http:// or https://.");
      }
      const result = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        country: country.trim(),
        professional_title: title.trim(),
        bio: bio.trim(),
        skills: skills.trim(),
        experience,
        portfolio_url: portfolioUrl
      }).eq("id", userId).select("id").maybeSingle();

      if (result.error) throw result.error;
      if (!result.data) throw new Error("Your profile record was not found. Please sign out and back in.");
      setNotice("Your profile has been saved.");
      refreshProfile();
    } catch (saveError) {
      setError("Unable to save your profile. " + saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user || user.accountType !== "Freelancer") {
    return null;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to="/freelancer-dashboard" className="dashboard-logo">
          TechKarvo
        </Link>

        <Link
          to="/freelancer-dashboard"
          className="dashboard-logout"
        >
          Back to Dashboard
        </Link>
      </header>

      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">FREELANCER PROFILE</span>
          <h1>My Professional Profile</h1>
          <p>Tell clients about your experience and skills.</p>
        </div>

        <form className="application-form" onSubmit={handleSave}>
          {error && <p role="alert">{error}</p>}
          {notice && <p className="auth-notice auth-notice--success" role="status">{notice}</p>}
          <h2>Personal Information</h2>

          <label htmlFor="freelancer-profile-name">Full Name</label>
          <input
            id="freelancer-profile-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label htmlFor="freelancer-profile-country">Country / City</label>
          <input
            id="freelancer-profile-country"
            type="text"
            placeholder="Example: Yangon, Myanmar"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            required
          />

          <h2>Professional Information</h2>

          <label htmlFor="freelancer-profile-title">Professional Title</label>
          <input
            id="freelancer-profile-title"
            type="text"
            placeholder="Example: Frontend Developer"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />

          <label htmlFor="freelancer-profile-bio">About Me</label>
          <textarea
            id="freelancer-profile-bio"
            placeholder="Tell clients about yourself..."
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            required
          />
          <label htmlFor="freelancer-profile-skills">Skills</label>
          <input
            id="freelancer-profile-skills"
            type="text"
            placeholder="React, JavaScript, CSS..."
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
            required
          />

          <label htmlFor="freelancer-profile-experience">Years of Experience</label>
          <select
            id="freelancer-profile-experience"
            value={experience}
            onChange={(event) => setExperience(event.target.value)}
            required
          >
            <option value="">Select Experience</option>
            <option value="Beginner">Beginner</option>
            <option value="Less than 1 year">Less than 1 year</option>
            <option value="1-2 years">1-2 years</option>
            <option value="3-5 years">3-5 years</option>
            <option value="5+ years">5+ years</option>
          </select>

          <label htmlFor="freelancer-profile-portfolio">Portfolio / LinkedIn URL</label>
          <input
            id="freelancer-profile-portfolio"
            type="url"
            placeholder="https://example.com"
            value={portfolio}
            onChange={(event) => setPortfolio(event.target.value)}
          />

          <button type="submit" className="primary-btn" disabled={saving || loading}>
            {loading ? "Loading Profile…" : saving ? "Saving…" : "Save Profile"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default FreelancerProfile;
