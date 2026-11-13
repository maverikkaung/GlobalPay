import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser } from "./auth.js";

function MyApplications() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [applications, setApplications] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");

  useEffect(function() {
    if (!user) {
      navigate("/login");
    } else if (user.accountType !== "Freelancer") {
      navigate("/client-dashboard");
    }
  }, [user, navigate]);

  useEffect(function() {
    if (user && user.accountType === "Freelancer") {
      try {
        const savedApplications = JSON.parse(
          localStorage.getItem("TechKarvo_applications") || "[]"
        );

        const myApplications = savedApplications.filter(function(item) {
          return item.email === user.email;
        });

        setApplications(myApplications);
      } catch (error) {
        setApplications([]);
      }
    }
  }, []);

  if (!user || user.accountType !== "Freelancer") {
    return null;
  }

  const filteredApplications = applications.filter(function(item) {
    if (selectedFilter === "All") {
      return true;
    }

    return item.status === selectedFilter;
  });

  const pendingCount = applications.filter(function(item) {
    return item.status === "Pending";
  }).length;

  const acceptedCount = applications.filter(function(item) {
    return item.status === "Accepted";
  }).length;

  const rejectedCount = applications.filter(function(item) {
    return item.status === "Rejected";
  }).length;

  return (
    <div className="dashboard-page applications-page">

      <header className="dashboard-navbar">
        <Link to="/freelancer-dashboard" className="dashboard-logo">
          TechKarvo
        </Link>

        <Link to="/freelancer-dashboard" className="dashboard-logout">
          Back to Dashboard
        </Link>
      </header>

      <main className="dashboard-container applications-container">

        <div className="applications-heading">
          <div>
            <span className="dashboard-tag">FREELANCER WORKSPACE</span>
            <h1>My Applications</h1>
            <p>Keep track of your job applications and their latest status.</p>
          </div>

          <Link to="/jobs" className="applications-find-button">
            + Find More Jobs
          </Link>
        </div>

        <section className="application-summary">

          <div className="application-summary-card">
            <span>Total Applications</span>
            <h2>{applications.length}</h2>
          </div>

          <div className="application-summary-card pending-summary">
            <span>Pending</span>
            <h2>{pendingCount}</h2>
          </div>

          <div className="application-summary-card accepted-summary">
            <span>Accepted</span>
            <h2>{acceptedCount}</h2>
          </div>

          <div className="application-summary-card rejected-summary">
            <span>Rejected</span>
            <h2>{rejectedCount}</h2>
          </div>

        </section>

        <section className="applications-section">

          <div className="applications-section-heading">
            <div>
              <h2>Application History</h2>
              <p>Review the jobs you have applied for.</p>
            </div>
          </div>

          <div className="application-filters">

            <button
              type="button"
              className={selectedFilter === "All" ? "active" : ""}
              onClick={function() {
                setSelectedFilter("All");
              }}
            >
              All <span>{applications.length}</span>
            </button>

            <button
              type="button"
              className={selectedFilter === "Pending" ? "active" : ""}
              onClick={function() {
                setSelectedFilter("Pending");
              }}
            >
              Pending <span>{pendingCount}</span>
            </button>
<button
              type="button"
              className={selectedFilter === "Accepted" ? "active" : ""}
              onClick={function() {
                setSelectedFilter("Accepted");
              }}
            >
              Accepted <span>{acceptedCount}</span>
            </button>

            <button
              type="button"
              className={selectedFilter === "Rejected" ? "active" : ""}
              onClick={function() {
                setSelectedFilter("Rejected");
              }}
            >
              Rejected <span>{rejectedCount}</span>
            </button>

          </div>

          {applications.length === 0 ? (

            <div className="applications-empty">
              <div className="applications-empty-icon">📄</div>
              <h2>No Applications Yet</h2>
              <p>You have not applied for any jobs yet. Start exploring opportunities.</p>
              <Link to="/jobs" className="applications-find-button">
                Explore Jobs
              </Link>
            </div>

          ) : filteredApplications.length === 0 ? (

            <div className="applications-empty">
              <div className="applications-empty-icon">🔍</div>
              <h2>No {selectedFilter} Applications</h2>
              <p>There are no applications in this category right now.</p>
            </div>

          ) : (

            <div className="applications-list">

              {filteredApplications.map(function(item, index) {
                const statusClass = item.status === "Accepted"
                  ? "accepted"
                  : item.status === "Rejected"
                  ? "rejected"
                  : "pending";

                return (
                  <div className="application-card" key={index}>

                    <div className="application-card-top">

                      <div className="application-job-info">
                        <div className="application-company-icon">
                          {item.company ? item.company.charAt(0).toUpperCase() : "G"}
                        </div>

                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.company || "Company not specified"}</p>
                        </div>
                      </div>

                      <span className={"application-status " + statusClass}>
                        {item.status || "Pending"}
                      </span>

                    </div>

                    <div className="application-card-details">

                      <div>
                        <span>Expected Salary</span>
                        <strong>
                          {item.expectedSalary
                            ? "$" + item.expectedSalary
                            : "Not specified"}
                        </strong>
                      </div>

                      <div>
                        <span>Applied Date</span>
                        <strong>
                          {item.appliedAt
                            ? new Date(item.appliedAt).toLocaleDateString()
                            : "Not available"}
                        </strong>
                      </div>

                    </div>

                    <div className="application-card-bottom">
                      <span className="application-reference">
                        Application #{index + 1}
                      </span>

                      <Link
                        to={"/jobs/" + item.id}
                        className="application-view-button"
                      >
                        View Job Details
                      </Link>
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

export default MyApplications;