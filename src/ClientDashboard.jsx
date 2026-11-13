import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCurrentUser, logoutUser } from "./auth.js";

function ClientDashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [activeProjects, setActiveProjects] = useState(0);
  const [totalHires, setTotalHires] = useState(0);
  const [totalSpending, setTotalSpending] = useState(0);

  useEffect(function() {
    if (!user || user.accountType !== "Client") {
      return;
    }

    try {
      const savedJobs = JSON.parse(
        localStorage.getItem("TechKarvo_client_jobs") || "[]"
      );

      const savedApplications = JSON.parse(
        localStorage.getItem("TechKarvo_applications") || "[]"
      );

      const myProjects = savedJobs.filter(function(item) {
        return item.clientEmail === user.email;
      });

      const myApplications = savedApplications.filter(function(item) {
        return (
          item.clientEmail === user.email &&
          item.status === "Accepted"
        );
      });

      const openProjects = myProjects.filter(function(item) {
        return item.status === "Open";
      });

      const hiredProjectIds = [];

      myApplications.forEach(function(item) {
        if (hiredProjectIds.indexOf(String(item.id)) === -1) {
          hiredProjectIds.push(String(item.id));
        }
      });

      let spending = 0;

      myProjects.forEach(function(project) {
        if (hiredProjectIds.indexOf(String(project.id)) !== -1) {
          spending = spending + Number(project.budget || 0);
        }
      });

      setActiveProjects(openProjects.length);
      setTotalHires(myApplications.length);
      setTotalSpending(spending);
    } catch (error) {
      setActiveProjects(0);
      setTotalHires(0);
      setTotalSpending(0);
    }
  }, []);

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

        <button onClick={handleLogout} className="dashboard-logout">
          Logout
        </button>
      </header>

      <main className="dashboard-container">

        <div className="dashboard-welcome">
          <span className="dashboard-tag">CLIENT DASHBOARD</span>
          <h1>Welcome back, {user.name}!</h1>
          <p>Find talented freelancers and manage your projects.</p>
        </div>

        <div className="dashboard-stats">

          <div className="dashboard-stat-card">
            <span>Active Projects</span>
            <h2>{activeProjects}</h2>
            <p>Your open projects</p>
          </div>

          <div className="dashboard-stat-card">
            <span>Total Hires</span>
            <h2>{totalHires}</h2>
            <p>Your accepted freelancers</p>
          </div>

          <div className="dashboard-stat-card">
            <span>Estimated Spending</span>
            <h2>${totalSpending.toFixed(2)}</h2>
            <p>Based on accepted projects</p>
          </div>

        </div>

        <section className="dashboard-section">

          <h2>Quick Actions</h2>

          <div className="dashboard-actions">

            <Link to="/post-job" className="dashboard-action-card">
              <span>📝</span>
              <h3>Post a Job</h3>
              <p>Find the right freelancer for your project.</p>
            </Link>

            <Link to="/job-applicants" className="dashboard-action-card">
              <span>👥</span>
              <h3>My Applicants</h3>
              <p>Review freelancers who applied for your jobs.</p>
            </Link>

            <Link to="/my-freelancers" className="dashboard-action-card">
              <span>👥</span>
              <h3>My Freelancers</h3>
              <p>Manage your hired freelancers.</p>
            </Link>
<Link to="/my-projects" className="dashboard-action-card">
              <span>📁</span>
              <h3>My Projects</h3>
              <p>View and manage your projects.</p>
            </Link>

          </div>
        </section>
      </main>
    </div>
  );
}

export default ClientDashboard;