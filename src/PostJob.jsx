import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { JOB_CATEGORIES } from "./marketplace.js";
import DashboardNav from "./DashboardNav.jsx";

function PostJob() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [budget, setBudget] = useState("");
  const [paymentType, setPaymentType] = useState("Fixed Price");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [featureCheck, setFeatureCheck] = useState(false);

  async function checkFeaturedAccess(checked) {
    if (!checked) { setFeatured(false); return; }
    setFeatureCheck(true);
    const result = await supabase.rpc("techkarvo_has_membership_feature", { p_feature: "featured_jobs" });
    setFeatureCheck(false);
    if (result.error || result.data !== true) {
      setError("Featured job placement requires an eligible active membership.");
      setFeatured(false);
      return;
    }
    setError("");
    setFeatured(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    if (user.accountType !== "Client") {
      setError("Only clients can post jobs.");
      return;
    }

    if (!user.id) {
      setError("We couldn't verify your account. Please sign out and sign in again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await supabase.from("jobs").insert({
        client_id: user.id,
        title: title.trim(),
        category: category,
        description: description.trim(),
        skills: skills.trim(),
        budget: Number(budget),
        currency: "USD",
        payment_type: paymentType,
        status: "open",
        is_featured: featured
      });
      if (result.error) {
        console.error("Job posting failed:", result.error.message);
        setError("We couldn't publish your project. Please check your connection and try again.");
        return;
      }
      setPublished(true);
    } catch (requestError) {
      console.error("Job posting failed:", requestError);
      setError("A network error interrupted publishing. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="dashboard-page">
        <h2>Please log in to post a job.</h2>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  if (user.accountType !== "Client") {
    return (
      <div className="dashboard-page">
        <h2>Only Clients can post jobs.</h2>
        <Link to="/freelancer-dashboard">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <DashboardNav user={user} />

      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">POST A JOB</span>
          <h1>Find Your Perfect Freelancer</h1>
          <p>Describe your project and connect with talented people.</p>
        </div>

        <form className="application-form" onSubmit={handleSubmit}>
          {error && <p className="auth-notice auth-notice--error" role="alert">{error}</p>}
          {published && <p className="auth-notice auth-notice--success" role="status">Your project is live. <Link to="/my-projects">Manage your projects</Link>.</p>}
          <h2>Job Information</h2>

          <label htmlFor="post-job-title">Job Title</label>
          <input
            id="post-job-title"
            type="text"
            placeholder="Example: React Developer Needed"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />

          <label htmlFor="post-job-category">Job Category</label>
          <select
            id="post-job-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          >
            <option value="">Select Category</option>
            {JOB_CATEGORIES.map((jobCategory) => <option key={jobCategory} value={jobCategory}>{jobCategory}</option>)}
          </select>

          <label className="admin-checkbox" htmlFor="post-job-featured">
            <input id="post-job-featured" type="checkbox" checked={featured} disabled={loading || featureCheck} onChange={(event) => checkFeaturedAccess(event.target.checked)} />
            Feature this job (eligible membership required)
          </label>

          <label htmlFor="post-job-description">Job Description</label>
          <textarea
            id="post-job-description"
            placeholder="Describe the work and project requirements..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
          <label htmlFor="post-job-skills">Required Skills</label>
          <input
            id="post-job-skills"
            type="text"
            placeholder="React, JavaScript, CSS..."
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
            required
          />

          <h2>Budget Information</h2>

          <label htmlFor="post-job-budget">Budget (USD)</label>
          <input
            id="post-job-budget"
            type="number"
            min="1"
            placeholder="Example: 500"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            required
          />

          <label htmlFor="post-job-payment-type">Payment Type</label>
          <select
            id="post-job-payment-type"
            value={paymentType}
            onChange={(event) => setPaymentType(event.target.value)}
          >
            <option value="Fixed Price">Fixed Price</option>
            <option value="Hourly">Hourly</option>
          </select>

          <button
            type="submit"
            className="primary-btn"
            disabled={loading || published}
          >
            {loading ? "Publishing..." : "Publish Job"}
          </button>
          {published && <Link to="/my-projects" className="primary-btn">Go to My Projects</Link>}
        </form>
      </main>
    </div>
  );
}

export default PostJob;
