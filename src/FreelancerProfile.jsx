import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { getRequestErrorMessage } from "./request-errors.js";
import DashboardNav from "./DashboardNav.jsx";
import ProfileMediaFields from "./ProfileMediaFields.jsx";
import { isValidMarketplaceImage, MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";

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
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [avatarPath, setAvatarPath] = useState("");
  const [coverPath, setCoverPath] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

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
      .then(async ({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(getRequestErrorMessage("Unable to load your profile", loadError));
        } else if (data) {
          setFullName(data.full_name || userName || "");
          setCountry(data.country || "");
          setTitle(data.professional_title || "");
          setBio(data.bio || "");
          setSkills(data.skills || "");
          setExperience(data.experience || "");
          setPortfolio(data.portfolio_url || "");
        }
        const media = await supabase.from("profiles").select("avatar_path, cover_path").eq("id", userId).maybeSingle();
        if (!media.error && media.data) {
          setAvatarPath(media.data.avatar_path || ""); setCoverPath(media.data.cover_path || ""); setMediaEnabled(true);
        }
        setLoading(false);
      }).catch((loadError) => {
        if (!active) return;
        setError(getRequestErrorMessage("Unable to load your profile", loadError));
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

    const uploadedPaths = [];
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const portfolioUrl = portfolio.trim() ? toSafeExternalUrl(portfolio) : null;
      if (portfolio.trim() && !portfolioUrl) {
        setError("Enter a valid portfolio URL starting with http:// or https://.");
        return;
      }
      async function uploadProfileImage(file) {
        if (!file) return null;
        if (!isValidMarketplaceImage(file)) throw new Error("Choose a JPEG, PNG, or WebP image up to 5 MiB.");
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${userId}/${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
        if (upload.error) throw upload.error;
        uploadedPaths.push(path);
        return path;
      }
      const nextAvatarPath = (await uploadProfileImage(avatarFile)) || avatarPath;
      const nextCoverPath = (await uploadProfileImage(coverFile)) || coverPath;
      const profileUpdate = {
        full_name: fullName.trim(),
        country: country.trim(),
        professional_title: title.trim(),
        bio: bio.trim(),
        skills: skills.trim(),
        experience,
        portfolio_url: portfolioUrl
      };
      if (mediaEnabled) {
        profileUpdate.avatar_path = nextAvatarPath || null;
        profileUpdate.cover_path = nextCoverPath || null;
      }
      const result = await supabase.from("profiles").update(profileUpdate).eq("id", userId).select("id").maybeSingle();

      if (result.error) throw result.error;
      if (!result.data) throw new Error("Your profile record was not found. Please sign out and back in.");
      const oldMedia = [avatarFile ? avatarPath : "", coverFile ? coverPath : ""].filter(Boolean);
      if (oldMedia.length) await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).remove(oldMedia);
      setAvatarPath(nextAvatarPath); setCoverPath(nextCoverPath); setAvatarFile(null); setCoverFile(null);
      setNotice(uploadedPaths.length ? "Your profile and photos have been saved." : "Your profile has been saved.");
      refreshProfile();
    } catch (saveError) {
      // New uploads are always in this user's storage folder; remove them if the profile update fails.
      // This also runs on validation or network failure after a partial upload.
      if (uploadedPaths.length) await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).remove(uploadedPaths);
      setError(getRequestErrorMessage("Unable to save your profile", saveError));
    } finally {
      setSaving(false);
    }
  }

  if (!user || user.accountType !== "Freelancer") {
    return null;
  }

  return (
    <div className="dashboard-page">
      <DashboardNav user={user} />

      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">FREELANCER PROFILE</span>
          <h1>My Professional Profile</h1>
          <p>Tell clients about your experience and skills.</p>
          <Link to={`/profiles/${user.id}`}>Preview profile</Link>
        </div>

        <form className="application-form" onSubmit={handleSave}>
          {error && <p role="alert">{error}</p>}
          {notice && <p className="auth-notice auth-notice--success" role="status">{notice}</p>}
          <h2>Personal Information</h2>

          <ProfileMediaFields enabled={mediaEnabled} avatarPath={avatarPath} coverPath={coverPath}
            avatarFile={avatarFile} coverFile={coverFile} disabled={saving || loading}
            onChange={(kind, file) => kind === "avatar" ? setAvatarFile(file) : setCoverFile(file)} />

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
