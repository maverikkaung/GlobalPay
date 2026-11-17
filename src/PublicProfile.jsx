import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { summarizeRatings } from "./marketplace.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { getRequestErrorMessage } from "./request-errors.js";

function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      setLoading(true);
      setError("");
      setProfile(null);
      setPortfolio([]);
      setReviews([]);
      const [freelancerResult, clientResult] = await Promise.all([
        supabase.from("freelancer_public_profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("client_public_profiles").select("*").eq("id", id).maybeSingle()
      ]);
      if (freelancerResult.error) throw freelancerResult.error;
      if (clientResult.error) throw clientResult.error;
      const currentProfile = freelancerResult.data || clientResult.data;
      if (!currentProfile) {
        if (active) setLoading(false);
        return;
      }
      const isFreelancerProfile = currentProfile.account_type === "freelancer";

      const [reviewsResult, portfolioResult] = await Promise.all([
        supabase.from("reviews_public").select("id, rating, body, created_at")
          .eq("reviewee_id", id).order("created_at", { ascending: false }),
        isFreelancerProfile
          ? supabase.from("portfolio_items").select("id, title, description, project_url, image_url")
            .eq("freelancer_id", id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null })
      ]);
      if (reviewsResult.error) throw reviewsResult.error;
      if (portfolioResult.error) throw portfolioResult.error;
      if (!active) return;
      setProfile(currentProfile);
      setReviews(reviewsResult.data || []);
      setPortfolio(portfolioResult.data || []);
      setLoading(false);
    }
    loadProfile().catch((loadError) => {
      if (!active) return;
      setError(getRequestErrorMessage("Unable to load profile", loadError));
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  const backLink = user.accountType === "Client" ? "/my-freelancers" : "/my-applications";
  const ratingSummary = summarizeRatings(reviews);
  const average = ratingSummary.average === null ? "New" : ratingSummary.average.toFixed(1);

  if (loading) return <div className="dashboard-page"><h2>Loading profile…</h2></div>;
  if (error) return <div className="dashboard-page"><p role="alert">{error}</p><Link to={backLink}>Go back</Link></div>;
  if (!profile) return <div className="dashboard-page"><h2>Profile not found</h2><Link to={backLink}>Go back</Link></div>;

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to={backLink} className="dashboard-logo">TechKarvo</Link>
        <Link to={backLink} className="dashboard-logout">Back</Link>
      </header>
      <main className="dashboard-container public-profile-page">
        <section className="public-profile-hero">
          <div className="public-profile-avatar">{(profile.full_name || "M").charAt(0).toUpperCase()}</div>
          <div><span className="dashboard-tag">{profile.account_type === "freelancer" ? "FREELANCER" : "CLIENT"}</span>
            <h1>{profile.full_name || "TechKarvo member"}</h1>
            <p>{profile.professional_title || profile.country || "Marketplace member"}</p>
          </div>
          <div className="profile-rating"><strong>{average}</strong><span>{ratingSummary.count ? `${ratingSummary.count} review${ratingSummary.count === 1 ? "" : "s"}` : "No reviews yet"}</span></div>
        </section>

        {profile.bio && <section className="dashboard-section"><h2>About</h2><p>{profile.bio}</p></section>}
        {profile.skills && <section className="dashboard-section"><h2>Skills</h2><p>{profile.skills}</p></section>}
        {profile.experience && <section className="dashboard-section"><h2>Experience</h2><p>{profile.experience}</p></section>}
        {toSafeExternalUrl(profile.portfolio_url) && <section className="dashboard-section"><a href={toSafeExternalUrl(profile.portfolio_url)} target="_blank" rel="noopener noreferrer">Portfolio link ↗</a></section>}

        {portfolio.length > 0 && <section className="dashboard-section"><h2>Selected work</h2><div className="portfolio-grid">{portfolio.map((item) => (
          <article className="portfolio-card" key={item.id}>{toSafeExternalUrl(item.image_url) && <img src={toSafeExternalUrl(item.image_url)} alt="" loading="lazy" />}<div><h3>{item.title}</h3><p>{item.description}</p>{toSafeExternalUrl(item.project_url) && <a href={toSafeExternalUrl(item.project_url)} target="_blank" rel="noopener noreferrer">View project ↗</a>}</div></article>
        ))}</div></section>}

        <section className="dashboard-section"><h2>Reviews</h2>{reviews.length === 0 ? <p>No reviews yet.</p> : <div className="public-review-list">{reviews.map((item) => (
          <article className="public-review" key={item.id}><strong>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)} <span>{item.rating}/5</span></strong>{item.body && <p>{item.body}</p>}<time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time></article>
        ))}</div>}</section>
      </main>
    </div>
  );
}

export default PublicProfile;
