import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { jobsData } from "./Jobs.jsx";
import { getCurrentUser } from "./auth.js";
import { supabase } from "./supabase.js";
import "./App.css";

function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    async function loadJob() {
      const result = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (result.data) {
        const item = result.data;
        let jobSkills = [];

        if (Array.isArray(item.skills)) {
          jobSkills = item.skills;
        } else {
          jobSkills = String(item.skills || "").split(",");
        }

        setJob({
          id: item.id,
          title: item.title,
          company: "TechKarvo Client",
          location: "Remote",
          type: item.payment_type || "Freelance",
          category: item.category || "Other",
          salary: String(item.currency || "USD") + " " + String(item.budget),
          description: item.description,
          details: item.description,
          skills: jobSkills.map(function(skill) {
            return skill.trim();
          }).filter(Boolean)
        });

        setLoading(false);
        return;
      }

      let clientJobs = [];

      try {
        const savedData = localStorage.getItem("TechKarvo_client_jobs");
        clientJobs = savedData ? JSON.parse(savedData) : [];
      } catch (error) {
        clientJobs = [];
      }

      const formattedJobs = clientJobs.map(function(item) {
        let jobSkills = [];

        if (Array.isArray(item.skills)) {
          jobSkills = item.skills;
        } else {
          jobSkills = String(item.skills || "").split(",");
        }

        return {
          ...item,
          skills: jobSkills.map(function(skill) {
            return skill.trim();
          }).filter(Boolean)
        };
      });

      const fallbackJobs = jobsData.concat(formattedJobs);

      const foundJob = fallbackJobs.find(function(item) {
        return String(item.id) === String(id);
      });

      setJob(foundJob || null);
      setLoading(false);
    }

    loadJob();
  }, [id]);

  function handleApply() {
    if (!user) {
      alert("Please log in to apply for this job.");
      navigate("/login");
      return;
    }

    if (user.accountType !== "Freelancer") {
      alert("Only Freelancers can apply for jobs.");
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

      <header className="jobs-navbar">
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
      </header>

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
                {job.company}
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

          {(!user || user.accountType === "Freelancer") && (
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