import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getRequestErrorMessage } from "./request-errors.js";
import DashboardNav from "./DashboardNav.jsx";
import ProfileMediaFields from "./ProfileMediaFields.jsx";
import { isValidMarketplaceImage, MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";

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
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [avatarPath, setAvatarPath] = useState("");
  const [coverPath, setCoverPath] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

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
      .then(async ({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(getRequestErrorMessage("Unable to load your profile", loadError));
        else if (data) {
          setFullName(data.full_name || userName || "");
          setCountry(data.country || "");
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

  async function saveProfile(event) {
    event.preventDefault();
    const uploadedPaths = [];
    setSaving(true);
    setError("");
    setNotice("");
    try {
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
        country: country.trim()
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
      refreshProfile();
      setNotice(uploadedPaths.length ? "Your profile and photos have been saved." : "Your profile has been saved.");
    } catch (saveError) {
      if (uploadedPaths.length) await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).remove(uploadedPaths);
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
          <ProfileMediaFields enabled={mediaEnabled} avatarPath={avatarPath} coverPath={coverPath}
            avatarFile={avatarFile} coverFile={coverFile} disabled={saving || loading}
            onChange={(kind, file) => kind === "avatar" ? setAvatarFile(file) : setCoverFile(file)} />
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
