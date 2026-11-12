import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser, logoutUser } from "./auth.js";

function FreelancerDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [activeJobs, setActiveJobs] = useState(0);
  const [pendingApplications, setPendingApplications] = useState(0);
  const [rejectedApplications, setRejectedApplications] = useState(0);

  useEffect(function() {
    if (!user || user.accountType !== "Freelancer") {
      return;
    }

    try {
      const savedApplications = JSON.parse(
        localStorage.getItem("globalpay_applications") || "[]"
      );

      const myApplications = savedApplications.filter(function(item) {
        return item.email === user.email;
      });

      const accepted = myApplications.filter(function(item) {
        return item.status === "Accepted";
      });

      const pending = myApplications.filter(function(item) {
        return item.status === "Pending";
      });

      const rejected = myApplications.filter(function(item) {
        return item.status === "Rejected";
      });

      setActiveJobs(accepted.length);
      setPendingApplications(pending.length);
      setRejectedApplications(rejected.length);

    } catch (error) {
      setActiveJobs(0);
      setPendingApplications(0);
      setRejectedApplications(0);
    }

  }, []);

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
          GlobalPay
        </Link>

        <button onClick={handleLogout} className="dashboard-logout">
          Logout
        </button>
      </header>

      <main className="dashboard-container">

        <div className="dashboard-welcome">
          <span className="dashboard-tag">FREELANCER DASHBOARD</span>
          <h1>Welcome back, {user.name}!</h1>
          <p>Manage your freelance journey with GlobalPay.</p>
        </div>

        <div className="dashboard-stats">

          <div className="dashboard-stat-card">
            <span>Active Jobs</span>
            <h2>{activeJobs}</h2>
            <p>Accepted applications</p>
          </div>

          <div className="dashboard-stat-card">
            <span>Pending Applications</span>
            <h2>{pendingApplications}</h2>
            <p>Waiting for client response</p>
          </div>

          <div className="dashboard-stat-card">
            <span>Rejected Applications</span>
            <h2>{rejectedApplications}</h2>
            <p>Applications not accepted</p>
          </div>

        </div>

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

            <div className="dashboard-action-card">
              <span>💳</span>
              <h3>My Wallet</h3>
              <p>Manage your freelance earnings.</p>
            </div>

          </div>
        </section>
 </main>
    </div>
  );
}

export default FreelancerDashboard;