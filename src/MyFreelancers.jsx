import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "./auth.js";
import { supabase } from "./supabase.js";

function MyFreelancers() {
  const user = getCurrentUser();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(function() {
    let active = true;

    async function loadFreelancers() {
      if (accountType !== "Client" || !userId) {
        setLoading(false);
        return;
      }

      const result = await supabase
        .from("job_applications")
        .select("*")
        .eq("client_id", userId)
        .eq("status", "Accepted")
        .order("applied_at", { ascending: false });

      if (!active) return;
      if (result.error) {
        setError("Unable to load hired freelancers. " + result.error.message);
        setLoading(false);
        return;
      }

      const rows = result.data || [];
      const jobIds = [...new Set(rows.map((item) => item.job_id))];
      let jobsById = {};
      if (jobIds.length) {
        const jobsResult = await supabase.from("jobs").select("id, title")
          .in("id", jobIds).eq("client_id", userId);
        if (!active) return;
        if (jobsResult.error) {
          setError("Freelancers loaded, but some job titles could not be loaded.");
        } else {
          jobsById = Object.fromEntries((jobsResult.data || []).map((job) => [String(job.id), job.title]));
        }
      }

      setFreelancers(rows.map((item) => ({
        ...item,
        id: item.job_id,
        title: jobsById[String(item.job_id)] || "Job #" + item.job_id,
        fullName: item.full_name,
        professionalTitle: item.professional_title,
        expectedSalary: item.expected_salary,
        salaryType: item.salary_type,
        appliedAt: item.applied_at
      })));
      setLoading(false);
    }

    loadFreelancers();
    return () => { active = false; };
  }, [userId, accountType]);

  if (!user) {
    return (
      <div className="dashboard-page">
        <h2>Please log in first.</h2>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  if (user.accountType !== "Client") {
    return (
      <div className="dashboard-page">
        <h2>Only Clients can view their freelancers.</h2>
        <Link to="/freelancer-dashboard">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      <header className="dashboard-navbar">
        <Link to="/" className="dashboard-logo">
          TechKarvo
        </Link>

        <Link to="/client-dashboard" className="dashboard-logout">
          Back to Dashboard
        </Link>
      </header>

      <main className="dashboard-container">

        <div className="dashboard-welcome">
          <span className="dashboard-tag">
            CLIENT MANAGEMENT
          </span>

          <h1>My Freelancers</h1>

          <p>
            Manage freelancers you have accepted for your jobs.
          </p>
        </div>

        <section className="dashboard-section">

          <h2>
            Accepted Freelancers ({freelancers.length})
          </h2>

          {error && <p role="alert">{error}</p>}
          {loading ? (
            <div className="no-jobs"><h3>Loading freelancers...</h3></div>
          ) : freelancers.length === 0 ? (
            <div className="no-jobs">
              <h3>No Freelancers Yet</h3>

              <p>
                Freelancers you accept will appear here.
              </p>

              <Link to="/job-applicants">
                View Applicants
              </Link>
            </div>
          ) : (
            <div className="jobs-grid">

              {freelancers.map(function(item) {
                return (
                  <div
                    className="job-card"
                    key={item.id + "-" + item.email}
                  >

                    <div className="job-card-top">
                      <div className="company-icon">
                        {(item.fullName || "F").charAt(0)}
                      </div>

                      <span className="job-type">
                        Accepted
                      </span>
                    </div>

                    <h3>{item.fullName}</h3>

                    <p className="job-company">
                      {item.professionalTitle}
                    </p>

                    <div className="details-description">
                      <h3>Email</h3>
                      <p>{item.email}</p>
                    </div>

                    <div className="details-description">
                      <h3>Job</h3>
                      <p>{item.title}</p>
                    </div>

                    <div className="details-description">
                      <h3>Location</h3>
                      <p>{item.country}</p>
                    </div>

                    <div className="details-description">
                      <h3>Skills</h3>
                      <p>{item.skills}</p>
                    </div>

                    <div className="details-description">
                      <h3>Experience</h3>
                      <p>{item.experience}</p>
                    </div>
<div className="details-description">
                      <h3>Portfolio</h3>
                      <p>{item.portfolio || "Not provided"}</p>
                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </section>
      </main>
    </div>
  );
}

export default MyFreelancers;
