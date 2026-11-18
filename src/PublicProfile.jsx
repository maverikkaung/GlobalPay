import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { summarizeRatings } from "./marketplace.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { getRequestErrorMessage } from "./request-errors.js";
import { MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";
import DashboardNav from "./DashboardNav.jsx";
import MemberSafetyActions from "./MemberSafetyActions.jsx";

function publicImage(path) {
  if (!path) return "";
  return toSafeExternalUrl(supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(path).data?.publicUrl) || "";
}

function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [posts, setPosts] = useState([]);
  const [connection, setConnection] = useState(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true); setError(""); setProfile(null); setPortfolio([]); setReviews([]); setPosts([]);
    try {
      const [freelancerResult, clientResult] = await Promise.all([
        supabase.from("freelancer_public_profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("client_public_profiles").select("*").eq("id", id).maybeSingle()
      ]);
      if (freelancerResult.error) throw freelancerResult.error;
      if (clientResult.error) throw clientResult.error;
      const currentProfile = freelancerResult.data || clientResult.data;
      if (!currentProfile) { setLoading(false); return; }
      const isFreelancer = currentProfile.account_type === "freelancer";
      const canSeePortfolio = isFreelancer && (user.accountType === "Client" || user.id === id);
      const [reviewsResult, portfolioResult, postsResult, connectionResult] = await Promise.all([
        supabase.from("reviews_public").select("id, rating, body, created_at")
          .eq("reviewee_id", id).order("created_at", { ascending: false }),
        canSeePortfolio
          ? supabase.from("portfolio_items").select("id, title, description, project_url, image_url")
            .eq("freelancer_id", id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("posts").select("id, author_id, post_type, body, image_path, portfolio_item_id, created_at")
          .eq("author_id", id).order("created_at", { ascending: false }).limit(20),
        user.id !== id
          ? supabase.from("connections").select("id, requester_id, recipient_id, status")
            .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (reviewsResult.error) throw reviewsResult.error;
      if (portfolioResult.error) throw portfolioResult.error;
      if (postsResult.error && !["PGRST205", "42P01"].includes(postsResult.error.code)) throw postsResult.error;
      if (connectionResult.error) throw connectionResult.error;
      if (user.id !== id) {
        setConnection((connectionResult.data || []).find((item) =>
          (item.requester_id === user.id && item.recipient_id === id)
          || (item.requester_id === id && item.recipient_id === user.id)
        ) || null);
      }
      setProfile(currentProfile); setReviews(reviewsResult.data || []);
      setPortfolio(portfolioResult.data || []); setPosts(postsResult.data || []);
    } catch (loadError) {
      setError(getRequestErrorMessage("Unable to load profile", loadError));
    } finally { setLoading(false); }
  }, [id, user.accountType, user.id]);

  useEffect(() => { const timer = window.setTimeout(loadProfile, 0); return () => window.clearTimeout(timer); }, [loadProfile]);

  const backLink = user.accountType === "Client" ? "/my-freelancers" : "/my-applications";
  const ratingSummary = summarizeRatings(reviews);
  const average = ratingSummary.average === null ? "New" : ratingSummary.average.toFixed(1);

  async function connectOrMessage() {
    if (!profile || profile.id === user.id || blockedByMe) return;
    setWorking(true); setError(""); setNotice("");
    try {
      let currentConnection = connection;
      if (!currentConnection) {
        const created = await supabase.from("connections").insert({ requester_id: user.id, recipient_id: id })
          .select("id, requester_id, recipient_id, status").single();
        if (created.error) throw created.error;
        setConnection(created.data); setNotice("Connection request sent. Messaging opens after the other member accepts."); return;
      }
      if (currentConnection.status === "Declined") { setNotice("This connection request was declined."); return; }
      if (currentConnection.status === "Pending") {
        if (currentConnection.requester_id === user.id) { setNotice("Your connection request is waiting for a response."); return; }
        const result = await supabase.from("connections").update({ status: "Accepted" })
          .eq("id", currentConnection.id).eq("recipient_id", user.id).eq("status", "Pending")
          .select("id, requester_id, recipient_id, status").single();
        if (result.error) throw result.error;
        currentConnection = result.data; setConnection(currentConnection);
      }
      const thread = await supabase.from("conversations").select("id")
        .eq("application_id", `connection:${currentConnection.id}`).single();
      if (thread.error) throw thread.error;
      navigate(`/messages?conversation=${encodeURIComponent(thread.data.id)}`);
    } catch (actionError) { setError(getRequestErrorMessage("Unable to connect with this member", actionError)); }
    finally { setWorking(false); }
  }

  if (loading) return <div className="dashboard-page"><DashboardNav user={user} /><main className="dashboard-container"><p role="status">Loading profile…</p></main></div>;
  if (error && !profile) return <div className="dashboard-page"><DashboardNav user={user} /><main className="dashboard-container"><p role="alert">{error}</p><button type="button" onClick={loadProfile}>Try again</button><Link to={backLink}>Go back</Link></main></div>;
  if (!profile) return <div className="dashboard-page"><DashboardNav user={user} /><main className="dashboard-container"><h2>Profile not found</h2><Link to={backLink}>Go back</Link></main></div>;

  const avatar = publicImage(profile.avatar_path);
  const cover = publicImage(profile.cover_path);
  const connectionText = connection?.status === "Accepted" ? "Message"
    : connection?.status === "Pending" && connection.requester_id === user.id ? "Request pending"
      : connection?.status === "Pending" ? "Accept connection" : connection?.status === "Declined" ? "Request declined" : "Connect";

  return <div className="dashboard-page">
    <DashboardNav user={user} />
    <main className="dashboard-container public-profile-page">
      {error && <p role="alert" className="profile-inline-error">{error}</p>}
      {notice && <p role="status" className="social-feed-notice">{notice}</p>}
      <section className="public-profile-hero">
        {cover && <img className="public-profile-cover" src={cover} alt="" />}
        <div className="public-profile-hero-content">
          {avatar ? <img className="public-profile-avatar" src={avatar} alt={`${profile.full_name || "Member"} profile`} />
            : <div className="public-profile-avatar" aria-hidden="true">{(profile.full_name || "M").charAt(0).toUpperCase()}</div>}
          <div className="public-profile-identity"><span className="dashboard-tag">{profile.account_type === "freelancer" ? "FREELANCER" : "CLIENT"}</span>
            <h1>{profile.full_name || "TechKarvo member"}</h1>
            <p>{profile.professional_title || profile.country || "Marketplace member"}</p>
            {profile.country && <span className="public-profile-location">{profile.country}</span>}
          </div>
          {user.id !== profile.id && <button className="social-primary-button" type="button" disabled={blockedByMe || working || connection?.status === "Pending" && connection.requester_id === user.id || connection?.status === "Declined"} onClick={connectOrMessage}>{blockedByMe ? "Blocked" : working ? "Opening…" : connectionText}</button>}
          <div className="profile-rating"><strong>{average}</strong><span>{ratingSummary.count ? `${ratingSummary.count} verified completed-project review${ratingSummary.count === 1 ? "" : "s"}` : "No verified reviews yet"}</span></div>
        </div>
      </section>

      {user.id !== profile.id && <MemberSafetyActions user={user} memberId={profile.id} memberName={profile.full_name} onBlockedChange={setBlockedByMe} />}

      {profile.bio && <section className="dashboard-section public-profile-section"><h2>About</h2><p>{profile.bio}</p></section>}
      {profile.skills && <section className="dashboard-section public-profile-section"><h2>Skills</h2><div className="public-profile-skills">{String(profile.skills).split(",").map((skill) => skill.trim()).filter(Boolean).map((skill) => <span key={skill}>{skill}</span>)}</div></section>}
      {profile.experience && <section className="dashboard-section public-profile-section"><h2>Experience</h2><p>{profile.experience}</p></section>}
      {toSafeExternalUrl(profile.portfolio_url) && <section className="dashboard-section public-profile-section"><h2>Portfolio link</h2><a href={toSafeExternalUrl(profile.portfolio_url)} target="_blank" rel="noopener noreferrer">View external portfolio ↗</a></section>}

      {portfolio.length > 0 && <section className="dashboard-section public-profile-section"><h2>Portfolio projects</h2><div className="portfolio-grid">{portfolio.map((item) => (
        <article className="portfolio-card" key={item.id}>{toSafeExternalUrl(item.image_url) && <img src={toSafeExternalUrl(item.image_url)} alt={`${item.title} preview`} loading="lazy" />}<div><h3>{item.title}</h3><p>{item.description}</p>{toSafeExternalUrl(item.project_url) && <a href={toSafeExternalUrl(item.project_url)} target="_blank" rel="noopener noreferrer">View project ↗</a>}</div></article>
      ))}</div></section>}

      {posts.length > 0 && <section className="dashboard-section public-profile-section"><h2>Professional posts and services</h2><div className="public-profile-posts">{posts.map((item) => (
        <article className="public-profile-post" key={item.id}><span className="social-eyebrow">{item.post_type === "service" ? "SERVICE SHOWCASE" : "PROFESSIONAL UPDATE"}</span><p>{item.body}</p>{item.image_path && publicImage(item.image_path) && <img src={publicImage(item.image_path)} alt="Professional post preview" loading="lazy" />}<time dateTime={item.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.created_at))}</time></article>
      ))}</div></section>}

      <section className="dashboard-section public-profile-section"><h2>Verified reviews</h2>{reviews.length === 0 ? <p>No completed-project reviews yet.</p> : <div className="public-review-list">{reviews.map((item) => (
        <article className="public-review" key={item.id}><strong aria-label={`${item.rating} out of 5 stars`}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)} <span>{item.rating}/5</span></strong>{item.body && <p>{item.body}</p>}<time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time></article>
      ))}</div>}</section>
    </main>
  </div>;
}

export default PublicProfile;
