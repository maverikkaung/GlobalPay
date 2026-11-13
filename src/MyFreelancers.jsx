import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "./auth.js";

function MyFreelancers() {
  const user = getCurrentUser();

  const [freelancers, setFreelancers] = useState([]);

  useEffect(function() {
    if (!user || user.accountType !== "Client") {
      return;
    }

    try {
      const savedApplications = JSON.parse(
        localStorage.getItem("TechKarvo_applications") || "[]"
      );

      const acceptedFreelancers = savedApplications.filter(function(item) {
        return (
          item.clientEmail === user.email &&
          item.status === "Accepted"
        );
      });

      setFreelancers(acceptedFreelancers);
    } catch (error) {
      setFreelancers([]);
    }
  }, []);

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

          {freelancers.length === 0 ? (
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

              {freelancers.map(function(item, index) {
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