import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { logoutUser } from "./auth.js";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { calculateClientHiringMetrics } from "./marketplace.js";

function ClientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [activeProjects, setActiveProjects] = useState(0);
  const [totalHires, setTotalHires] = useState(0);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    async function loadDashboard() {
      if (!userId) {
        setLoading(false);
        return;
      }

      if (accountType !== "Client") {
        setLoading(false);
        return;
      }

      try {
        const jobsResult = await supabase
          .from("jobs")
          .select("id, budget, status")
          .eq("client_id", userId);

        if (jobsResult.error) {
          throw jobsResult.error;
        }

        const myJobs = jobsResult.data;

        const openProjects = myJobs.filter(function(item) {
          return item.status === "open";
        });

        setActiveProjects(openProjects.length);

        const applicationResult = await supabase
          .from("job_applications")
          .select("job_id")
          .eq("client_id", userId)
          .eq("status", "Accepted");

        if (applicationResult.error) throw applicationResult.error;

        const metrics = calculateClientHiringMetrics(applicationResult.data || [], myJobs);
        setTotalHires(metrics.totalHires);
        setTotalSpending(metrics.totalSpending);

      } catch (error) {
        console.error("Dashboard loading error:", error);
        alert("Unable to load dashboard data: " + error.message);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [userId, accountType]);

  async function handleLogout() {
    await logoutUser();
    navigate("/login");
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  if (user.accountType !== "Client") {
    if (user.accountType === "Freelancer") {
      navigate("/freelancer-dashboard");
    } else {
      navigate("/");
    }

    return null;
  }

  return (
    <div className="dashboard-page">

      <header className="dashboard-navbar">
        <Link to="/" className="dashboard-logo">
          TechKarvo
        </Link>

        <button
          onClick={handleLogout}
          className="dashboard-logout"
        >
          Logout
        </button>
      </header>

      <main className="dashboard-container">

        <div className="dashboard-welcome">
          <span className="dashboard-tag">
            CLIENT DASHBOARD
          </span>

          <h1>Welcome back, {user.name}!</h1>

          <p>
            Find talented freelancers and manage your projects.
          </p>
        </div>

        <div className="dashboard-stats">

          <div className="dashboard-stat-card">
            <span>Active Projects</span>
            <h2>
              {loading ? "..." : activeProjects}
            </h2>
            <p>Your open projects</p>
          </div>
            <div className="dashboard-stat-card">
            <span>Total Hires</span>
            <h2>
              {loading ? "..." : totalHires}
            </h2>
            <p>Your accepted freelancers</p>
          </div>

          <div className="dashboard-stat-card">
            <span>Estimated Spending</span>
            <h2>
              {loading ? "..." : "$" + totalSpending.toFixed(2)}
            </h2>
            <p>Based on accepted projects</p>
          </div>

        </div>

        <section className="dashboard-section">

          <h2>Quick Actions</h2>

          <div className="dashboard-actions">

            <Link
              to="/post-job"
              className="dashboard-action-card"
            >
              <span>📝</span>
              <h3>Post a Job</h3>
              <p>
                Find the right freelancer for your project.
              </p>
            </Link>

            <Link
              to="/job-applicants"
              className="dashboard-action-card"
            >
              <span>👥</span>
              <h3>My Applicants</h3>
              <p>
                Review freelancers who applied for your jobs.
              </p>
            </Link>

            <Link
              to="/my-freelancers"
              className="dashboard-action-card"
            >
              <span>👥</span>
              <h3>My Freelancers</h3>
              <p>
                Manage your hired freelancers.
              </p>
            </Link>

            <Link
              to="/my-projects"
              className="dashboard-action-card"
            >
              <span>📁</span>
              <h3>My Projects</h3>
              <p>
                View and manage your projects.
              </p>
            </Link>

          </div>
        </section>

      </main>
    </div>
  );
}

export default ClientDashboard;
