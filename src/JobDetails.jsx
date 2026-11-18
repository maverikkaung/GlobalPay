import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { parseSkills } from "./marketplace.js";
import DashboardNav from "./DashboardNav.jsx";
import "./App.css";

function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const currentUserId = user?.id;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    let active = true;
    async function loadJob() {
      if (active) setLoading(true);
      try {
        const result = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) {
          if (active) setJob(null);
          return;
        }

        const item = result.data;
        let company = "TechKarvo Client";
        if (isAuthenticated && item.client_id) {
          const clientResult = await supabase.from("client_public_profiles")
            .select("full_name").eq("id", item.client_id).maybeSingle();
          if (clientResult.error) {
            console.error("Client profile lookup failed:", clientResult.error.message);
          } else if (clientResult.data?.full_name) {
            company = clientResult.data.full_name;
          }
        }

        if (!active) return;
        setJob({
          id: item.id,
          clientId: item.client_id,
          title: item.title,
          company,
          location: "Remote",
          type: item.payment_type || "Freelance",
          category: item.category || "Other",
          salary: String(item.currency || "USD") + " " + String(item.budget),
          description: item.description,
          details: item.description,
          status: item.status,
          skills: parseSkills(item.skills)
        });
      } catch (error) {
        console.error("Job loading error:", error);
        if (active) setJob(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadJob();
    return () => { active = false; };
  }, [id, isAuthenticated, currentUserId]);

  function handleApply() {
    if (!user) {
      navigate("/login", { state: { from: "/apply/" + job.id } });
      return;
    }

    if (user.accountType !== "Freelancer") {
      navigate("/client-dashboard");
      return;
    }

    navigate("/apply/" + job.id);
  }

  if (loading) {
    return (
      <div className="job-details-page">
        <h2>Loading Project...</h2>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="job-details-page">
        <h2>Project Not Found</h2>
        <Link to="/jobs">Back to Jobs</Link>
      </div>
    );
  }

  let dashboardLink = "/";

  if (user) {
    if (user.accountType === "Client") {
      dashboardLink = "/client-dashboard";
    } else {
      dashboardLink = "/freelancer-dashboard";
    }
  }

  return (
    <div className="job-details-page">

      {user ? <DashboardNav user={user} /> : <header className="jobs-navbar">
        <Link to="/" className="logo">
          TechKarvo
        </Link>

        <div className="jobs-nav-links">
          <Link to="/">Home</Link>
          <Link to="/jobs" className="active">
            Find Jobs
          </Link>

          {user ? (
            <Link to={dashboardLink}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign Up</Link>
            </>
          )}
        </div>
      </header>}

      <main className="job-details-container">

        <Link to="/jobs" className="back-jobs">
          Back to Jobs
        </Link>

        <section className="job-details-card">
             <div className="details-top">
            <div>
              <span className="job-category">
                {job.category}
              </span>

              <h1>{job.title}</h1>

              <p className="details-company">
                {user && job.clientId
                  ? <Link to={"/profiles/" + job.clientId}>{job.company}</Link>
                  : job.company}
              </p>
            </div>

            <span className="job-type">
              {job.type || "Freelance"}
            </span>
          </div>

          <div className="details-info">

            <div>
              <span>Location</span>
              <strong>{job.location || "Remote"}</strong>
            </div>

            <div>
              <span>Project Budget / Salary</span>
              <strong>{job.salary || "Negotiable"}</strong>
            </div>

          </div>

          <div className="details-description">
            <h2>About This Opportunity</h2>
            <p>{job.details || job.description}</p>
          </div>

          <div className="details-skills">
            <h2>Required Skills</h2>

            <div className="skills-list">
              {job.skills.map(function(skill, index) {
                return (
                  <span key={index}>
                    {skill}
                  </span>
                );
              })}
            </div>
          </div>

          {job.status === "open" && (!user || user.accountType === "Freelancer") && (
            <div className="details-actions">
              <button
                type="button"
                onClick={handleApply}
              >
                Apply for This Job
              </button>
            </div>
          )}

        </section>
      </main>

      <footer className="jobs-footer">
        © 2026 TechKarvo. All rights reserved.
      </footer>

    </div>
  );
}

export default JobDetails;
