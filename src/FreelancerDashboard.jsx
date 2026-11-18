import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { countApplicationStatuses, countOpenAcceptedJobs } from "./marketplace.js";
import { getRequestErrorMessage } from "./request-errors.js";
import DashboardNav from "./DashboardNav.jsx";
import { SocialFeed } from "./SocialFeed.jsx";

function FreelancerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [activeJobs, setActiveJobs] = useState(0);
  const [pendingApplications, setPendingApplications] = useState(0);
  const [rejectedApplications, setRejectedApplications] = useState(0);
  const [withdrawnApplications, setWithdrawnApplications] = useState(0);
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
        setWithdrawnApplications(counts.withdrawn);
      } catch (loadError) {
        if (!active) return;
        setError(getRequestErrorMessage("Unable to load your dashboard summary", loadError));
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

  if (!user || user.accountType !== "Freelancer") {
    return null;
  }

  return (
    <div className="dashboard-page">

      <DashboardNav user={user} />

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
            <p>Accepted open jobs · payment is not secured</p>
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

          <div className="dashboard-stat-card">
            <span>Withdrawn Applications</span>
            <h2>{loading ? "…" : withdrawnApplications}</h2>
            <p>Applications you withdrew</p>
          </div>

        </div>

        {error && <p role="alert">{error}</p>}

        <SocialFeed user={user} />

 </main>
    </div>
  );
}

export default FreelancerDashboard;
