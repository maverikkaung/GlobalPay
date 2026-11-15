import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";

function JobApplicants() {
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(function() {
    let active = true;
    async function loadApplications() {
      if (accountType !== "Client" || !userId) return;

      const result = await supabase.from("job_applications").select("*")
        .eq("client_id", userId).order("applied_at", { ascending: false });
      if (!active) return;
      if (result.error) {
        setError("Unable to load applicants. " + result.error.message);
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
          setError("Applicants loaded, but some job titles could not be loaded.");
        } else {
          jobsById = Object.fromEntries((jobsResult.data || []).map((job) => [String(job.id), job.title]));
        }
      }

      setApplications(rows.map((item) => ({
        ...item,
        applicationId: item.id,
        id: item.job_id,
        title: jobsById[String(item.job_id)] || "Job #" + item.job_id,
        fullName: item.full_name,
        professionalTitle: item.professional_title,
        expectedSalary: item.expected_salary,
        salaryType: item.salary_type,
        coverLetter: item.cover_letter,
        appliedAt: item.applied_at
      })));
      setLoading(false);
    }

    loadApplications().catch((loadError) => {
      if (active) {
        setError("Unable to load applicants. " + loadError.message);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [userId, accountType]);

  async function updateStatus(application, newStatus) {
    const result = await supabase.from("job_applications")
      .update({ status: newStatus })
      .eq("id", application.applicationId)
      .eq("client_id", userId)
      .select("id, status")
      .single();

    if (result.error) {
      setError("Application status could not be updated. " + result.error.message);
      return;
    }

    setApplications((current) => current.map((item) => item.applicationId === application.applicationId
      ? { ...item, status: result.data.status }
      : item));
    setError("");
  }

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
        <h2>Only Clients can view applicants.</h2>
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

          <h1>My Applicants</h1>

          <p>
            Review freelancers who applied for your jobs.
          </p>
        </div>

        <div className="dashboard-section">

          <h2>
            Applications ({applications.length})
          </h2>

          {error && <p role="alert">{error}</p>}
          {loading ? (
            <div className="no-jobs"><h3>Loading applicants...</h3></div>
          ) : applications.length === 0 ? (
            <div className="no-jobs">
              <h3>No Applications Yet</h3>
              <p>
                Freelancers who apply for your jobs will appear here.
              </p>
            </div>
          ) : (
            <div className="jobs-grid">

                    {applications.map(function(application) {
                return (
                  <div className="job-card" key={application.id + "-" + application.email}>

                    <div className="job-card-top">
                      <div className="company-icon">
                        {(application.fullName || "F").charAt(0)}
                      </div>

                      <span className="job-type">
                        {application.status}
                      </span>
                    </div>

                    <h3>{application.fullName}</h3>

                    <p className="job-company">
                      {application.professionalTitle}
                    </p>

                    <div className="job-info">
                      <span>{application.country}</span>
                      <span>{application.experience}</span>
                    </div>
<div className="details-description">
                      <h3>Applied Job</h3>
                      <p>{application.title}</p>
                    </div>

                    <div className="details-description">
                      <h3>Email</h3>
                      <p>{application.email}</p>
                    </div>

                    <div className="details-description">
                      <h3>Skills</h3>
                      <p>{application.skills}</p>
                    </div>

                    <div className="details-description">
                      <h3>About Freelancer</h3>
                      <p>{application.bio}</p>
                    </div>

                    <div className="details-description">
                      <h3>Cover Letter</h3>
                      <p>{application.coverLetter}</p>
                    </div>

                    <div className="details-description">
                      <h3>Expected Salary</h3>
                      <p>
                        ${application.expectedSalary} USD - {application.salaryType}
                      </p>
                    </div>

                    <div className="details-description">
                      <h3>Portfolio</h3>
                      <p>{application.portfolio || "Not provided"}</p>
                    </div>

                    <div className="details-description">
                      <h3>Applied Date</h3>
                      <p>{application.appliedAt}</p>
                    </div>

                    {application.status === "Pending" ? (
                      <div className="job-card-actions">

                        <button
                          type="button"
                          className="apply-btn"
                          onClick={function() {
                            updateStatus(application, "Accepted");
                          }}
                        >
                          Accept
                        </button>

                        <button
                          type="button"
                          className="dashboard-logout"
                          onClick={function() {
                            updateStatus(application, "Rejected");
                          }}
                        >
                          Reject
                        </button>

                      </div>
                    ) : (
                      <p>
                        Application Status: {application.status}
                      </p>
                    )}

                  </div>
                );
              })}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default JobApplicants;
