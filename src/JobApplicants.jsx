import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "./auth.js";

function JobApplicants() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [applications, setApplications] = useState([]);

  useEffect(function() {
    if (!user || user.accountType !== "Client") {
      return;
    }

    try {
      const savedApplications = JSON.parse(
        localStorage.getItem("TechKarvo_applications") || "[]"
      );

      const myApplications = savedApplications.filter(function(item) {
        return item.clientEmail === user.email;
      });

      setApplications(myApplications);
    } catch (error) {
      setApplications([]);
    }
  }, []);

  function updateStatus(application, newStatus) {
    let savedApplications = [];

    try {
      savedApplications = JSON.parse(
        localStorage.getItem("TechKarvo_applications") || "[]"
      );
    } catch (error) {
      savedApplications = [];
    }

    const updatedApplications = savedApplications.map(function(item) {
      if (
        String(item.id) === String(application.id) &&
        item.email === application.email &&
        item.clientEmail === user.email
      ) {
        return {
          ...item,
          status: newStatus
        };
      }

      return item;
    });

    localStorage.setItem(
      "TechKarvo_applications",
      JSON.stringify(updatedApplications)
    );

    const myApplications = updatedApplications.filter(function(item) {
      return item.clientEmail === user.email;
    });

    setApplications(myApplications);

    alert("Application status updated to " + newStatus + ".");
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

          {applications.length === 0 ? (
            <div className="no-jobs">
              <h3>No Applications Yet</h3>
              <p>
                Freelancers who apply for your jobs will appear here.
              </p>
            </div>
          ) : (
            <div className="jobs-grid">

              {applications.map(function(application, index) {
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