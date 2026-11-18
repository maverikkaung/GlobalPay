import { useEffect, useState } from "react";
import { toSafeExternalUrl } from "./external-urls.js";
import { supabase } from "./supabase.js";
import { MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";

function publicUrl(path) {
  if (!path) return "";
  return toSafeExternalUrl(supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(path).data?.publicUrl) || "";
}

function Preview({ file, path, label, className }) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      const frame = window.requestAnimationFrame(() => setPreview(""));
      return () => window.cancelAnimationFrame(frame);
    }
    const objectUrl = URL.createObjectURL(file);
    const frame = window.requestAnimationFrame(() => setPreview(objectUrl));
    return () => { window.cancelAnimationFrame(frame); URL.revokeObjectURL(objectUrl); };
  }, [file]);
  const image = preview || publicUrl(path);
  return image ? <img className={className} src={image} alt={file ? `Selected ${label} preview` : `Current ${label}`} /> : <span className={`${className} profile-media-placeholder`} aria-hidden="true">{label}</span>;
}

export default function ProfileMediaFields({ enabled, avatarPath, coverPath, avatarFile, coverFile, onChange, disabled = false }) {
  if (!enabled) return <aside className="profile-media-pending" role="note">
    <h2>Profile photos</h2><p>Photo uploads become available after the reviewed staging media schema is applied. Your other profile details can still be saved.</p>
  </aside>;

  return <fieldset className="profile-media-fields" disabled={disabled}>
    <legend>Profile photos</legend>
    <p>These images appear on your public TechKarvo profile. Use a clear profile photo and a wide cover image.</p>
    <div className="profile-media-grid">
      <label className="profile-media-field"><span>Profile photo</span><Preview file={avatarFile} path={avatarPath} label="Profile photo" className="profile-media-avatar" />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onChange("avatar", event.target.files?.[0] || null)} />
      </label>
      <label className="profile-media-field"><span>Cover photo</span><Preview file={coverFile} path={coverPath} label="Cover photo" className="profile-media-cover" />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onChange("cover", event.target.files?.[0] || null)} />
      </label>
    </div>
    <small>JPEG, PNG, or WebP up to 5 MiB. Images are public on your marketplace profile.</small>
  </fieldset>;
}
