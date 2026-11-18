import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { calculateClientHiringMetrics } from "./marketplace.js";
import { getRequestErrorMessage } from "./request-errors.js";
import DashboardNav from "./DashboardNav.jsx";
import { SocialFeed } from "./SocialFeed.jsx";

function ClientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [activeProjects, setActiveProjects] = useState(0);
  const [totalHires, setTotalHires] = useState(0);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(function() {
    let active = true;
    async function loadDashboard() {
      setLoading(true);
      setError("");
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

        const myJobs = jobsResult.data || [];

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
        if (!active) return;
        setTotalHires(metrics.totalHires);
        setTotalSpending(metrics.totalSpending);

      } catch (error) {
        if (!active) return;
        console.error("Dashboard loading error:", error);
        setError(getRequestErrorMessage("Unable to load dashboard data", error));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => { active = false; };
  }, [userId, accountType]);

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

      <DashboardNav user={user} />

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

        {error && <p role="alert">{error}</p>}

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
            <p>Estimated from accepted projects · no funds are held</p>
          </div>

        </div>

        <SocialFeed user={user} />

      </main>
    </div>
  );
}

export default ClientDashboard;
