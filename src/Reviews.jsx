import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getRequestErrorMessage } from "./request-errors.js";

function Reviews() {
  const { user } = useAuth();
  const [eligibleJobs, setEligibleJobs] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dashboard = user.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard";

  useEffect(() => {
    let active = true;
    async function loadEligibleJobs() {
      const column = user.accountType === "Client" ? "client_id" : "freelancer_id";
      const applicationsResult = await supabase.from("job_applications")
        .select("id, job_id, client_id, freelancer_id, full_name, status")
        .eq(column, user.id).eq("status", "Accepted");
      if (applicationsResult.error) throw applicationsResult.error;

      const applications = applicationsResult.data || [];
      const jobIds = [...new Set(applications.map((item) => item.job_id))];
      let jobsById = {};
      if (jobIds.length) {
        const jobsResult = await supabase.from("jobs").select("id, title, status").in("id", jobIds);
        if (jobsResult.error) throw jobsResult.error;
        jobsById = Object.fromEntries((jobsResult.data || []).map((item) => [String(item.id), item]));
      }

      const reviewsResult = await supabase.from("reviews").select("application_id")
        .eq("reviewer_id", user.id);
      if (reviewsResult.error) throw reviewsResult.error;
      const alreadyReviewed = new Set((reviewsResult.data || []).map((item) => String(item.application_id)));

      if (!active) return;
      setEligibleJobs(applications.filter((item) => {
        const job = jobsById[String(item.job_id)];
        return job?.status === "completed" && !alreadyReviewed.has(String(item.id));
      }).map((item) => ({
        ...item,
        jobTitle: jobsById[String(item.job_id)]?.title || "Completed project",
        revieweeId: user.accountType === "Client" ? item.freelancer_id : item.client_id,
        revieweeName: user.accountType === "Client" ? item.full_name || "Freelancer" : "Client"
      })));
      setLoading(false);
    }

    loadEligibleJobs().catch((loadError) => {
      if (!active) return;
      setError(getRequestErrorMessage("Unable to load review opportunities", loadError));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user.id, user.accountType]);

  async function submitReview(event, application) {
    event.preventDefault();
    const rating = ratings[application.id] || 5;
    setSavingId(application.id);
    setError("");
    setNotice("");
    try {
      const result = await supabase.from("reviews").insert({
        application_id: String(application.id),
        job_id: String(application.job_id),
        reviewer_id: user.id,
        reviewee_id: application.revieweeId,
        rating,
        body: comments[application.id]?.trim() || ""
      });

      if (result.error) {
        console.error("Review submission failed:", result.error.message);
        setError(result.error.code === "23505"
          ? "You have already reviewed this project. Refresh to update the list."
          : "Unable to submit your review. Please try again.");
        return;
      }
      setEligibleJobs((items) => items.filter((item) => item.id !== application.id));
      setNotice("Your review was submitted.");
    } catch (submitError) {
      console.error("Review submission failed:", submitError);
      setError("A network error interrupted review submission. Please try again.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to={dashboard} className="dashboard-logo">TechKarvo</Link>
        <Link to={dashboard} className="dashboard-logout">Back to Dashboard</Link>
      </header>
      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">COMMUNITY FEEDBACK</span>
          <h1>Reviews</h1>
          <p>Share a fair, useful review after a project is marked complete.</p>
        </div>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {loading ? <div className="no-jobs"><h3>Loading review opportunities…</h3></div> : eligibleJobs.length === 0 ? (
          <div className="no-jobs"><h3>No reviews to write</h3><p>Completed projects will appear here when they are ready for feedback.</p></div>
        ) : (
          <div className="review-list">
            {eligibleJobs.map((application) => (
              <article className="review-card" key={application.id}>
                <div><span>{application.jobTitle}</span><h2>Review {application.revieweeName}</h2></div>
                <form onSubmit={(event) => submitReview(event, application)}>
                  <label htmlFor={`rating-${application.id}`}>Rating</label>
                  <select id={`rating-${application.id}`} value={ratings[application.id] || 5} onChange={(event) => setRatings((current) => ({ ...current, [application.id]: Number(event.target.value) }))}>
                    <option value="5">★★★★★ Excellent</option>
                    <option value="4">★★★★☆ Good</option>
                    <option value="3">★★★☆☆ Okay</option>
                    <option value="2">★★☆☆☆ Needs improvement</option>
                    <option value="1">★☆☆☆☆ Poor</option>
                  </select>
                  <label htmlFor={`review-${application.id}`}>Written review (optional)</label>
                  <textarea id={`review-${application.id}`} maxLength={3000} rows={4} value={comments[application.id] || ""} onChange={(event) => setComments((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Share clear, respectful feedback…" />
                  <button type="submit" className="primary-btn" disabled={savingId === application.id}>{savingId === application.id ? "Submitting…" : "Submit Review"}</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Reviews;
