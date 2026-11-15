import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { logoutUser } from "./auth.js";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { countApplicationStatuses, countOpenAcceptedJobs } from "./marketplace.js";

function FreelancerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [activeJobs, setActiveJobs] = useState(0);
  const [pendingApplications, setPendingApplications] = useState(0);
  const [rejectedApplications, setRejectedApplications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(function() {
    let active = true;

    async function loadApplications() {
      setLoading(true);
      setError("");
      if (accountType !== "Freelancer" || !userId) {
        setLoading(false);
        return;
      }

      try {
        const result = await supabase
          .from("job_applications")
          .select("status, job_id")
          .eq("freelancer_id", userId);
        if (result.error) throw result.error;

        const applications = result.data || [];
        const counts = countApplicationStatuses(applications);
        const acceptedJobIds = [...new Set(applications
          .filter((application) => application.status === "Accepted")
          .map((application) => String(application.job_id)))];
        let jobs = [];
        if (acceptedJobIds.length) {
          const jobsResult = await supabase.from("jobs").select("id, status").in("id", acceptedJobIds);
          if (jobsResult.error) throw jobsResult.error;
          jobs = jobsResult.data || [];
        }

        if (!active) return;
        setActiveJobs(countOpenAcceptedJobs(applications, jobs));
        setPendingApplications(counts.pending);
        setRejectedApplications(counts.rejected);
      } catch (loadError) {
        if (!active) return;
        setError("Unable to load your dashboard summary. " + loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadApplications();
    return () => { active = false; };
  }, [userId, accountType]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (user.accountType !== "Freelancer") {
      if (user.accountType === "Client") {
        navigate("/client-dashboard");
      } else {
        navigate("/");
      }
    }
  }, [user, navigate]);

   async function handleLogout() {
  await logoutUser();
  navigate("/login");
}

  if (!user || user.accountType !== "Freelancer") {
    return null;
  }

  return (
    <div className="dashboard-page">

      <header className="dashboard-navbar">
        <Link to="/" className="dashboard-logo">
          TechKarvo
        </Link>

        <button onClick={handleLogout} className="dashboard-logout">
          Logout
        </button>
      </header>

      <main className="dashboard-container">

        <div className="dashboard-welcome">
          <span className="dashboard-tag">FREELANCER DASHBOARD</span>
          <h1>Welcome back, {user.name}!</h1>
          <p>Manage your freelance journey with TechKarvo.</p>
        </div>

        <div className="dashboard-stats">

          <div className="dashboard-stat-card">
            <span>Active Jobs</span>
            <h2>{loading ? "…" : activeJobs}</h2>
            <p>Accepted applications</p>
          </div>

          <div className="dashboard-stat-card">
            <span>Pending Applications</span>
            <h2>{loading ? "…" : pendingApplications}</h2>
            <p>Waiting for client response</p>
          </div>

          <div className="dashboard-stat-card">
            <span>Rejected Applications</span>
            <h2>{loading ? "…" : rejectedApplications}</h2>
            <p>Applications not accepted</p>
          </div>

        </div>

        {error && <p role="alert">{error}</p>}

        <section className="dashboard-section">

          <h2>Quick Actions</h2>

          <div className="dashboard-actions">

            <Link to="/jobs" className="dashboard-action-card">
              <span>🔍</span>
              <h3>Find Jobs</h3>
              <p>Explore available freelance opportunities.</p>
            </Link>

            <Link to="/my-applications" className="dashboard-action-card">
              <span>💼</span>
              <h3>My Applications</h3>
              <p>Track your job applications.</p>
            </Link>

            <Link to="/freelancer-profile" className="dashboard-action-card">
              <span>👤</span>
              <h3>My Profile</h3>
              <p>Manage your professional profile and skills.</p>
            </Link>

            <Link to="/portfolio" className="dashboard-action-card">
              <span>🗂️</span>
              <h3>My Portfolio</h3>
              <p>Show clients examples of your best work.</p>
            </Link>

            <Link to="/messages" className="dashboard-action-card">
              <span>✉️</span>
              <h3>Messages</h3>
              <p>Talk with clients about applications and work.</p>
            </Link>

            <Link to="/notifications" className="dashboard-action-card">
              <span>🔔</span>
              <h3>Notifications</h3>
              <p>See application and message updates.</p>
            </Link>

            <Link to="/reviews" className="dashboard-action-card">
              <span>⭐</span>
              <h3>Reviews</h3>
              <p>Review clients when completed work is ready.</p>
            </Link>

          </div>
        </section>
 </main>
    </div>
  );
}

export default FreelancerDashboard;
