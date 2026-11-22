import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { summarizeRatings } from "./marketplace.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { getRequestErrorMessage } from "./request-errors.js";
import { MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";
import { isProfileId, mayShowPortfolio, profileConnection, profileMediaPath, profileSkills, PROFILE_FIELDS, PROJECT_FIELDS, REVIEW_FIELDS } from "./profile-preview.js";
import DashboardNav from "./DashboardNav.jsx";
import MemberSafetyActions from "./MemberSafetyActions.jsx";
import PortfolioProject from "./PortfolioProject.jsx";

function profileImage(path, ownerId) {
  const ownedPath = profileMediaPath(path, ownerId);
  return ownedPath ? toSafeExternalUrl(supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(ownedPath).data?.publicUrl) : null;
}

async function optionalSection(query) {
  try {
    const { data, error } = await query;
    return error ? null : data ?? [];
  } catch {
    return null;
  }
}

async function readProfile(id, user) {
  if (!isProfileId(id) || !isProfileId(user.id)) return null;
  const owner = user.id === id;
  if (!owner) {
    const block = await supabase.rpc("techkarvo_is_blocked_with", { p_other_user_id: id });
    if (block.error || typeof block.data !== "boolean") throw block.error || new Error("Unable to verify access");
    if (block.data) {
      const ownBlock = await supabase.from("user_blocks").select("blocked_id")
        .eq("blocker_id", user.id).eq("blocked_id", id).maybeSingle();
      return ownBlock.data?.blocked_id === id ? { blockedByViewer: true } : null;
    }
  }

  const [freelancer, client] = await Promise.all([
    supabase.from("freelancer_public_profiles").select(PROFILE_FIELDS).eq("id", id).maybeSingle(),
    supabase.from("client_public_profiles").select(PROFILE_FIELDS).eq("id", id).maybeSingle()
  ]);
  if (freelancer.error || client.error) throw freelancer.error || client.error;
  const profile = [freelancer.data, client.data].find((row) => row?.id === id);
  if (!profile) return null;

  const showPortfolio = mayShowPortfolio(profile, user);
  const [reviews, projects, posts, connections] = await Promise.all([
    optionalSection(supabase.from("reviews_public").select(REVIEW_FIELDS)
      .eq("reviewee_id", id).order("created_at", { ascending: false })),
    showPortfolio ? optionalSection(supabase.from("portfolio_items").select(PROJECT_FIELDS)
      .eq("freelancer_id", id).order("created_at", { ascending: false })) : undefined,
    optionalSection(supabase.from("posts").select("id,post_type,body,image_path,created_at")
      .eq("author_id", id).order("created_at", { ascending: false }).limit(20)),
    owner ? [] : optionalSection(supabase.from("connections").select("id,requester_id,recipient_id,status")
      .or(`and(requester_id.eq.${user.id},recipient_id.eq.${id}),and(requester_id.eq.${id},recipient_id.eq.${user.id})`))
  ]);
  return { profile, showPortfolio, reviews, projects, posts, connections };
}

function ProfileMedia({ src, className, fallback = null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return <img src={src} className={className} alt="" decoding="async"
    referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function Section({ id, title, children }) {
  return <section id={id} tabIndex={-1} aria-labelledby={`${id}-heading`} className="profile-preview-section">
    <h2 id={`${id}-heading`}>{title}</h2>
    {children}
  </section>;
}

function ProfileDate({ value }) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return <time dateTime={value}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))}</time>;
}

function ProfessionalProfile({ id, user }) {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [result, setResult] = useState({ loading: true });
  const [revision, setRevision] = useState(0);
  const [connectionOverride, setConnectionOverride] = useState(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(false);
  const [working, setWorking] = useState(false);
  const { id: viewerId, accountType } = user;
  const owner = viewerId === id;
  const back = accountType === "Client" ? "/my-freelancers" : "/my-applications";
  const editor = accountType === "Client" ? "/client-profile" : "/freelancer-profile";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    readProfile(id, { id: viewerId, accountType }).then(
      (data) => { if (active) setResult({ data }); },
      (error) => { if (active) setResult({ error: getRequestErrorMessage("Unable to load profile", error) }); }
    );
    return () => { active = false; };
  }, [id, viewerId, accountType, revision]);

  const refresh = useCallback(() => {
    setResult({ loading: true });
    setConnectionOverride(null);
    setActionError("");
    setNotice("");
    setRevision((value) => value + 1);
  }, []);
  const onBlock = useCallback((blocked) => { if (blocked) refresh(); }, [refresh]);
  const onUnblock = useCallback((blocked) => { if (!blocked) refresh(); }, [refresh]);

  const { profile, reviews, projects, posts, showPortfolio, connections, blockedByViewer } = result.data || {};
  useEffect(() => {
    if (profile && ["#professional-information", "#portfolio-projects", "#verified-reviews", "#professional-updates"].includes(hash)) {
      document.getElementById(hash.slice(1))?.focus();
    }
  }, [hash, profile]);
  const connection = connectionOverride || connections?.find((row) =>
    (row.requester_id === viewerId && row.recipient_id === id)
    || (row.recipient_id === viewerId && row.requester_id === id));
  const connectionAction = profileConnection(connection, viewerId);

  async function connectOrMessage() {
    if (!profile || owner || connections === null || connectionAction.disabled || busy.current) return;
    busy.current = true;
    setWorking(true);
    setActionError("");
    setNotice("");
    try {
      let current = connection;
      if (!current) {
        const created = await supabase.from("connections").insert({ requester_id: viewerId, recipient_id: id })
          .select("id,requester_id,recipient_id,status").single();
        if (created.error) throw created.error;
        setConnectionOverride(created.data);
        setNotice("Connection request sent. Messaging opens after the other member accepts.");
        return;
      }
      if (current.status === "Pending") {
        const accepted = await supabase.from("connections").update({ status: "Accepted" })
          .eq("id", current.id).eq("requester_id", id).eq("recipient_id", viewerId).eq("status", "Pending")
          .select("id,requester_id,recipient_id,status").single();
        if (accepted.error) throw accepted.error;
        current = accepted.data;
        setConnectionOverride(current);
      }
      const thread = await supabase.from("conversations").select("id")
        .eq("application_id", `connection:${current.id}`).single();
      if (thread.error) throw thread.error;
      if (mounted.current) navigate(`/messages?conversation=${encodeURIComponent(thread.data.id)}`);
    } catch (error) {
      setActionError(getRequestErrorMessage("Unable to connect with this member", error));
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }

  const skills = profileSkills(profile?.skills);
  const portfolioLink = profile && toSafeExternalUrl(profile.portfolio_url);
  const validReviews = reviews?.filter(({ rating }) => Number.isInteger(rating) && rating >= 1 && rating <= 5);
  const rating = validReviews && summarizeRatings(validReviews);
  const hasAbout = profile && Boolean(profile.bio || profile.experience || skills.length);
  const hasPortfolio = showPortfolio || portfolioLink;
  const hasPosts = posts === null || Boolean(posts?.length);
  const name = profile?.full_name || "TechKarvo member";
  const partial = [reviews, projects, posts, connections].some((part) => part === null);

  return <div className="dashboard-page">
    <DashboardNav user={user} />
    <main className="dashboard-container profile-preview">
      <Link className="profile-preview-link profile-preview-back" to={owner ? editor : back}>
        <span aria-hidden="true">←</span> {owner ? "Back to profile editor" : "Back to marketplace"}
      </Link>
      {result.loading ? <p className="profile-preview-state" role="status">Loading profile…</p>
        : result.error ? <section className="profile-preview-state">
          <h1>Profile unavailable</h1><p role="alert">{result.error}</p>
          <button className="social-primary-button" type="button" onClick={refresh}>Try again</button>
        </section>
        : !profile ? <section className="profile-preview-state">
          <h1>Profile unavailable</h1><p>This member profile cannot be viewed.</p>
          {blockedByViewer && <MemberSafetyActions user={user} memberId={id} onBlockedChange={onUnblock} />}
        </section>
        : <>
          <header className="profile-preview-hero">
            <div className="profile-preview-cover">
              <ProfileMedia key={profile.cover_path} src={profileImage(profile.cover_path, id)} />
            </div>
            <div className="profile-preview-hero-body">
              <ProfileMedia key={profile.avatar_path} className="profile-preview-avatar" src={profileImage(profile.avatar_path, id)}
                fallback={<span className="profile-preview-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>} />
              <div className="profile-preview-identity">
                <p className="profile-preview-role">{profile.account_type === "freelancer" ? "Freelancer" : "Client"}</p>
                <h1>{name}</h1>
                {profile.professional_title && <p>{profile.professional_title}</p>}
                {profile.country && <p className="profile-preview-location">{profile.country}</p>}
              </div>
              <div className="profile-preview-actions">
                {owner ? <Link className="social-primary-button" to={editor}>Edit profile</Link>
                  : connections !== null && <button className="social-primary-button" type="button" disabled={working || connectionAction.disabled}
                    onClick={connectOrMessage}>{working ? "Working…" : connectionAction.label}</button>}
                {owner && accountType === "Freelancer" && <Link className="profile-preview-link" to="/portfolio">Manage portfolio</Link>}
              </div>
            </div>
          </header>

          {actionError && <p role="alert" className="profile-preview-state">{actionError}</p>}
          {notice && <p role="status" className="profile-preview-state">{notice}</p>}
          {partial && <div className="profile-preview-state">
            <p role="status">Some profile sections could not be loaded.</p>
            <button className="profile-preview-link" type="button" onClick={refresh}>Retry profile details</button>
          </div>}
          {!owner && <MemberSafetyActions user={user} memberId={id} memberName={name} onBlockedChange={onBlock} />}

          <nav className="profile-preview-nav" aria-label="Profile sections">
            {hasAbout && <a href="#professional-information">About</a>}
            {hasPortfolio && <a href="#portfolio-projects">Portfolio</a>}
            <a href="#verified-reviews">Reviews</a>
            {hasPosts && <a href="#professional-updates">Activity</a>}
          </nav>

          <div className={hasAbout ? "profile-preview-columns" : undefined}>
            {hasAbout && <Section id="professional-information" title="Professional information">
              {profile.bio && <p>{profile.bio}</p>}
              {skills.length > 0 && <><h3>Skills</h3><ul className="profile-preview-skills">{skills.map((skill) => <li key={skill}>{skill}</li>)}</ul></>}
              {profile.experience && <><h3>Experience</h3><p>{profile.experience}</p></>}
            </Section>}
            <div className="profile-preview-details">
              {hasPortfolio && <Section id="portfolio-projects" title={showPortfolio ? "Portfolio projects" : "External portfolio"}>
                {portfolioLink && <a className="profile-preview-link" href={portfolioLink} target="_blank" rel="noopener noreferrer"
                  aria-label="Visit external portfolio (opens in a new tab)">Visit external portfolio <span aria-hidden="true">↗</span></a>}
                {showPortfolio && (projects === null ? <p>Portfolio projects are unavailable.</p>
                  : projects.length ? <div className="profile-preview-projects">{projects.map((item) => <PortfolioProject project={item} key={item.id} />)}</div>
                    : <p>No portfolio projects yet.</p>)}
              </Section>}
              <Section id="verified-reviews" title="Verified reviews">
                {reviews === null ? <p>Reviews are unavailable.</p> : rating?.count > 0 ? <>
                  <p className="profile-preview-rating"><strong>{rating.average.toFixed(1)} / 5</strong> <span>{rating.count} completed-project {rating.count === 1 ? "review" : "reviews"}</span></p>
                  <ul className="profile-preview-reviews">
                    {validReviews.map((item) => <li key={item.id}><strong>{item.rating} / 5</strong><ProfileDate value={item.created_at} />
                      {item.body && <p>{item.body}</p>}</li>)}
                  </ul>
                </> : <p>No completed-project reviews yet.</p>}
              </Section>
              {hasPosts && <Section id="professional-updates" title="Professional activity">
                {posts === null ? <p>Professional activity is unavailable.</p> : <div className="public-profile-posts">{posts.map((item) => <article className="public-profile-post" key={item.id}>
                  <span className="social-eyebrow">{item.post_type === "service" ? "Service showcase" : "Professional update"}</span>
                  <p>{item.body}</p><ProfileMedia src={profileImage(item.image_path, id)} /><ProfileDate value={item.created_at} />
                </article>)}</div>}
              </Section>}
            </div>
          </div>
        </>}
    </main>
  </div>;
}

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  return <ProfessionalProfile key={`${user.id}:${id}`} id={id.toLowerCase()} user={user} />;
}
