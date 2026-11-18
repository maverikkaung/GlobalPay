import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import DashboardNav from "./DashboardNav.jsx";
import { getAcceptedWorkPresentation, isOptionalContractSchemaMissing } from "./project-workflow.js";

function MyApplications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [applications, setApplications] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawingId, setWithdrawingId] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(function() {
    let active = true;

    async function loadApplications() {
      setLoading(true);
      setError("");
      if (!userId) {
        navigate("/login");
        setLoading(false);
        return;
      }

      if (accountType !== "Freelancer") {
        navigate("/client-dashboard");
        setLoading(false);
        return;
      }

      try {
        const applicationResult = await supabase
          .from("job_applications")
          .select("*")
          .eq("freelancer_id", userId)
          .order("applied_at", { ascending: false });
        if (applicationResult.error) throw applicationResult.error;
        if (!active) return;

        const applicationRows = applicationResult.data || [];
        const jobMap = {};

        if (applicationRows.length > 0) {
          const jobIds = applicationRows.map((item) => item.job_id);
          const jobsResult = await supabase
            .from("jobs")
            .select("id, title, category, budget, currency, status")
            .in("id", jobIds);
          if (!active) return;

          if (!jobsResult.error) {
            (jobsResult.data || []).forEach((job) => {
              jobMap[String(job.id)] = job;
            });
          } else {
            console.error("Application job details failed to load:", jobsResult.error.message);
            setError("Your applications loaded, but some job details are unavailable.");
          }
        }

        const acceptedApplications = applicationRows.filter((item) => item.status === "Accepted");
        const contractByApplication = {};
        if (acceptedApplications.length) {
          const contractsResult = await supabase.from("contracts")
            .select("application_id, status")
            .in("application_id", acceptedApplications.map((item) => item.id));
          if (!active) return;
          if (!contractsResult.error) {
            (contractsResult.data || []).forEach((contract) => {
              contractByApplication[String(contract.application_id)] = contract.status;
            });
          } else if (!isOptionalContractSchemaMissing(contractsResult.error)) {
            setError("Your applications loaded, but contract status is temporarily unavailable.");
          }
        }

        setApplications(applicationRows.map((item) => {
          const job = jobMap[String(item.job_id)];
          return {
            id: item.job_id,
            clientId: item.client_id,
            applicationId: item.id,
            title: job ? job.title : "Job #" + item.job_id,
            company: job?.category || "Client",
            status: item.status,
            jobStatus: job?.status || null,
            contractStatus: contractByApplication[String(item.id)] || null,
            expectedSalary: item.expected_salary,
            salaryType: item.salary_type,
            appliedAt: item.applied_at
          };
        }));
      } catch (loadError) {
        if (!active) return;
        console.error("Applications failed to load:", loadError);
        setApplications([]);
        setError("Unable to load your applications. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadApplications();

    return function() {
      active = false;
    };
  }, [userId, accountType, navigate, loadAttempt]);

  async function withdrawApplication(application) {
    const confirmed = window.confirm("Withdraw this pending application? You will no longer be considered for the project.");
    if (!confirmed) return;

    setWithdrawingId(application.applicationId);
    setError("");
    try {
      const result = await supabase.from("job_applications").update({ status: "Withdrawn" })
        .eq("id", application.applicationId)
        .eq("freelancer_id", userId)
        .eq("status", "Pending")
        .select("id, status")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        setError("This application is no longer pending and could not be withdrawn.");
        return;
      }
      setApplications((current) => current.map((item) => item.applicationId === application.applicationId
        ? { ...item, status: result.data.status }
        : item));
    } catch (withdrawError) {
      console.error("Application withdrawal failed:", withdrawError);
      setError("Unable to withdraw this application. Please try again.");
    } finally {
      setWithdrawingId("");
    }
  }

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

  const withdrawnCount = applications.filter(function(item) {
    return item.status === "Withdrawn";
  }).length;

  return (
    <div className="dashboard-page applications-page">

      <DashboardNav user={user} />

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

          <div className="application-summary-card">
            <span>Withdrawn</span>
            <h2>{withdrawnCount}</h2>
          </div>

        </section>

        <section className="applications-section">

          <div className="applications-section-heading">
            <div>
              <h2>Application History</h2>
              <p>Review the jobs you have applied for.</p>
            </div>
          </div>

          {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button></div>}

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

            <button
              type="button"
              className={selectedFilter === "Withdrawn" ? "active" : ""}
              onClick={function() {
                setSelectedFilter("Withdrawn");
              }}
            >
              Withdrawn <span>{withdrawnCount}</span>
            </button>

          </div>

          {loading ? (

            <div className="applications-empty">
              <h2>Loading Applications...</h2>
              <p>Please wait while we load your applications.</p>
            </div>

          ) : error && applications.length === 0 ? (

            <div className="applications-empty">
              <h2>Unable to Load Applications</h2>
              <p>{error}</p>
            </div>

          ) : applications.length === 0 ? (

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

              {filteredApplications.map(function(item) {
                const statusClass = item.status === "Accepted"
                  ? "accepted"
                  : item.status === "Rejected"
                  ? "rejected"
                  : "pending";

                return (
                  <div className="application-card" key={item.applicationId}>

                    <div className="application-card-top">
                       <div className="application-job-info">
                        <div className="application-company-icon">
                          {item.company
                            ? item.company.charAt(0).toUpperCase()
                            : "G"}
                        </div>

                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.company}</p>
                        </div>
                      </div>

                      <span className={"application-status " + statusClass}>
                        {item.status}
                      </span>

                    </div>

                    <div className="application-card-details">

                      <div>
                        <span>Expected Salary</span>
                        <strong>
                          {item.expectedSalary !== null &&
                          item.expectedSalary !== undefined
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

                    {item.status === "Accepted" && (() => {
                      const presentation = getAcceptedWorkPresentation({
                        applicationStatus: item.status,
                        jobStatus: item.jobStatus,
                        contractStatus: item.contractStatus
                      });
                      return <div className="project-work-status" aria-label="Hiring and contract status">
                        <strong>{presentation.label}</strong>
                        <p>{presentation.detail}</p>
                      </div>;
                    })()}

                    <div className="application-card-bottom">
                      <span className="application-reference">
                        Application #{item.applicationId}
                      </span>

                      <Link
                        to={"/jobs/" + item.id}
                        className="application-view-button"
                      >
                        View Job Details
                      </Link>
                      {(item.status === "Pending" || item.status === "Accepted") && (
                        <Link to={`/messages?application=${encodeURIComponent(item.applicationId)}`} className="application-view-button">
                          Message Client
                        </Link>
                      )}
                      {item.clientId && <Link to={`/profiles/${item.clientId}`} className="application-view-button">View Client Reviews</Link>}
                      {item.status === "Pending" && (
                        <button
                          type="button"
                          className="application-withdraw-button"
                          disabled={withdrawingId === item.applicationId}
                          onClick={() => withdrawApplication(item)}
                        >
                          {withdrawingId === item.applicationId ? "Withdrawing…" : "Withdraw application"}
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}

            </div>

          )}

          {error && applications.length > 0 && (
            <p className="applications-error">{error}</p>
          )}

        </section>

      </main>
    </div>
  );
}

export default MyApplications;
