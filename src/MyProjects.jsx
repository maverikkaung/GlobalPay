import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import DashboardNav from "./DashboardNav.jsx";
import { getAcceptedWorkPresentation, isOptionalContractSchemaMissing } from "./project-workflow.js";

function MyProjects() {
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;

  const [projects, setProjects] = useState([]);
  const [workflowByJob, setWorkflowByJob] = useState({});
  const [workflowError, setWorkflowError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [budget, setBudget] = useState("");
  const [paymentType, setPaymentType] = useState("Fixed Price");

  useEffect(function() {
    let active = true;
    async function loadProjects() {
      setLoading(true);
      setLoadError("");
      if (accountType !== "Client" || !userId) {
        setLoading(false);
        return;
      }

      try {
        const result = await supabase.from("jobs").select("*")
          .eq("client_id", userId).order("created_at", { ascending: false });
        if (!active) return;
        if (result.error) throw result.error;
        const projectRows = result.data || [];
        setProjects(projectRows);
        setWorkflowByJob({});
        setWorkflowError("");
        if (!projectRows.length) return;

        const projectIds = projectRows.map((project) => project.id);
        const applicationsResult = await supabase.from("job_applications")
          .select("id, job_id, status").eq("client_id", userId)
          .eq("status", "Accepted").in("job_id", projectIds);
        if (!active) return;
        if (applicationsResult.error) {
          setWorkflowError("Project details loaded, but hiring status could not be refreshed.");
          return;
        }

        const accepted = applicationsResult.data || [];
        const contractByApplication = {};
        if (accepted.length) {
          const contractsResult = await supabase.from("contracts")
            .select("id, application_id, status").in("application_id", accepted.map((item) => item.id));
          if (!active) return;
          if (!contractsResult.error) {
            (contractsResult.data || []).forEach((contract) => {
              contractByApplication[String(contract.application_id)] = contract;
            });
          } else if (!isOptionalContractSchemaMissing(contractsResult.error)) {
            setWorkflowError("Project details loaded, but contract status is temporarily unavailable.");
          }
        }
        const acceptedByJob = Object.fromEntries(accepted.map((item) => [String(item.job_id), item]));
        setWorkflowByJob(Object.fromEntries(projectRows.map((project) => {
          const application = acceptedByJob[String(project.id)];
          return [String(project.id), {
            applicationStatus: application?.status || null,
            contractStatus: application ? contractByApplication[String(application.id)]?.status || null : null,
            contractId: application ? contractByApplication[String(application.id)]?.id : null
          }];
        })));
      } catch (error) {
        if (!active) return;
        console.error("Unable to load projects:", error);
        setLoadError("Unable to load projects. Please refresh and try again.");
        setProjects([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProjects().catch((error) => {
      if (!active) return;
      console.error("Unable to load projects:", error);
      setLoadError("Unable to load projects. Please refresh and try again.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId, accountType, loadAttempt]);

  function startEdit(project) {
    setEditingId(project.id);
    setTitle(project.title || "");
    setCategory(project.category || "");
    setDescription(project.description || "");
    setSkills(project.skills || "");
    setBudget(String(project.budget));
    setPaymentType(project.payment_type || "Fixed Price");

    window.scrollTo(0, 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setCategory("");
    setDescription("");
    setSkills("");
    setBudget("");
    setPaymentType("Fixed Price");
  }

  async function saveEdit(event) {
    event.preventDefault();

    if (
      title.trim() === "" ||
      category.trim() === "" ||
      description.trim() === "" ||
      budget === "" ||
      Number(budget) <= 0
    ) {
      setActionError("Complete every required field and enter a budget above zero.");
      return;
    }

    setSaving(true);
    setActionError("");
    setActionNotice("");
    try {
      const result = await supabase.from("jobs").update({
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        skills: skills.trim(),
        budget: Number(budget),
        payment_type: paymentType
      })
      .eq("id", editingId)
      .eq("client_id", user.id)
      .select("id, title, category, description, skills, budget, payment_type, status")
      .maybeSingle();

      if (result.error) throw result.error;
      if (!result.data) {
        setActionError("This project could not be updated. Refresh and try again.");
        return;
      }

      setProjects((current) => current.map((item) =>
        String(item.id) === String(editingId) ? { ...item, ...result.data } : item));
      cancelEdit();
      setActionNotice("Project details saved.");
    } catch (error) {
      console.error("Project update failed:", error);
      setActionError("Project update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmDelete) {
      return;
    }

    setActionError("");
    setActionNotice("");
    setPendingAction("delete:" + String(project.id));
    try {
      const applicationsResult = await supabase.from("job_applications").select("id")
        .eq("job_id", project.id).limit(1);
      if (applicationsResult.error) throw applicationsResult.error;
      if (applicationsResult.data?.length) {
        setActionError("This project has application history and cannot be deleted. Mark it complete to keep its history available.");
        return;
      }

      const result = await supabase.from("jobs").delete()
        .eq("id", project.id).eq("client_id", user.id).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        setActionError("This project could not be deleted. It may have application history.");
        return;
      }

      setProjects((current) => current.filter((item) => String(item.id) !== String(project.id)));
      if (String(editingId) === String(project.id)) cancelEdit();
      setActionNotice("Project deleted.");
    } catch (error) {
      console.error("Project deletion failed:", error);
      setActionError("Project deletion failed. Please try again.");
    } finally {
      setPendingAction("");
    }
  }

  async function completeProject(project) {
    setActionError("");
    setActionNotice("");
    setPendingAction("complete:" + String(project.id));
    try {
      const acceptedResult = await supabase.from("job_applications").select("id")
        .eq("client_id", user.id).eq("job_id", project.id).eq("status", "Accepted").limit(1);
      if (acceptedResult.error) throw acceptedResult.error;
      if (!acceptedResult.data?.length) {
        setActionError("Accept a freelancer before marking this project complete.");
        return;
      }

      const result = await supabase.from("jobs").update({ status: "completed" })
        .eq("id", project.id).eq("client_id", user.id).select("id, status").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        setActionError("This project could not be completed. Refresh and try again.");
        return;
      }
      setProjects((current) => current.map((item) => String(item.id) === String(project.id)
        ? { ...item, status: result.data.status }
        : item));
      setActionNotice("Project marked complete.");
    } catch (error) {
      console.error("Project completion failed:", error);
      setActionError("Unable to complete this project. Please try again.");
    } finally {
      setPendingAction("");
    }
  }

  if (!user) {
    return (
      <div className="dashboard-page">
        <h2>Please login first.</h2>
        <Link to="/login">Login</Link>
      </div>
    );
  }
        if (user.accountType !== "Client") {
    return (
      <div className="dashboard-page">
        <h2>Client account required.</h2>
        <Link to="/">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="dashboard-page my-projects-page">

      <DashboardNav user={user} />

      <main className="dashboard-container my-projects-container">

        <section className="my-projects-hero">
          <div>
            <span className="dashboard-tag">CLIENT WORKSPACE</span>
            <h1>My Projects</h1>
            <p>
              Manage your posted jobs, update project details,
              and keep track of your opportunities.
            </p>
          </div>

          <Link to="/post-job" className="my-projects-post-button">
            + Post New Project
          </Link>
        </section>

        <section className="my-projects-overview">
          <div className="my-projects-overview-card">
            <span>Total Projects</span>
            <strong>{projects.length}</strong>
            <p>Projects you have posted</p>
          </div>

          <div className="my-projects-overview-card">
            <span>Open Projects</span>
            <strong>
              {projects.filter(function(project) {
                return project.status === "open";
              }).length}
            </strong>
            <p>Currently accepting applications</p>
          </div>

          <div className="my-projects-overview-card">
            <span>Other Status</span>
            <strong>
              {projects.filter(function(project) {
                return project.status !== "open";
              }).length}
            </strong>
            <p>Closed or inactive projects</p>
          </div>
        </section>

        {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button></div>}
        {workflowError && <p role="status">{workflowError}</p>}
        {actionError && <p role="alert">{actionError}</p>}
        {actionNotice && <p role="status">{actionNotice}</p>}

        {editingId !== null && (
          <section className="my-projects-edit-section">
            <div className="my-projects-section-heading">
              <div>
                <span>PROJECT SETTINGS</span>
                <h2>Edit Project</h2>
              </div>
            </div>

            <form onSubmit={saveEdit} className="auth-form">

              <label htmlFor="edit-project-title">Job Title</label>
              <input
                id="edit-project-title"
                type="text"
                value={title}
                onChange={function(event) {
                  setTitle(event.target.value);
                }}
                required
              />

              <label htmlFor="edit-project-category">Category</label>
              <input
                id="edit-project-category"
                type="text"
                value={category}
                onChange={function(event) {
                  setCategory(event.target.value);
                }}
                required
              />

              <label htmlFor="edit-project-description">Description</label>
              <textarea
                id="edit-project-description"
                value={description}
                onChange={function(event) {
                  setDescription(event.target.value);
                }}
                required
              />

              <label htmlFor="edit-project-skills">Required Skills</label>
              <input
                id="edit-project-skills"
                type="text"
                value={skills}
                onChange={function(event) {
                  setSkills(event.target.value);
                }}
              />

              <label htmlFor="edit-project-budget">Budget (USD)</label>
              <input
                id="edit-project-budget"
                type="number"
                min="1"
                value={budget}
                onChange={function(event) {
                  setBudget(event.target.value);
                }}
                required
              />

              <label htmlFor="edit-project-payment-type">Payment Type</label>
              <select
                id="edit-project-payment-type"
                value={paymentType}
                onChange={function(event) {
                  setPaymentType(event.target.value);
                }}
              >
                <option value="Fixed Price">Fixed Price</option>
                <option value="Hourly">Hourly</option>
              </select>
                 <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>

            </form>
          </section>
        )}

        <section className="my-projects-list-section">

          <div className="my-projects-section-heading">
            <div>
              <span>YOUR WORK</span>
              <h2>Posted Projects</h2>
            </div>

            <span className="my-projects-count">
              {projects.length} Projects
            </span>
          </div>

          {loading ? (
            <div className="my-projects-empty">
              <h3>Loading your projects...</h3>
              <p>Please wait while we retrieve your projects.</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="my-projects-empty">
              <div className="my-projects-empty-icon">＋</div>
              <h3>No Projects Yet</h3>
              <p>
                You have not posted any projects.
                Create your first project to start finding freelancers.
              </p>
              <Link to="/post-job" className="my-projects-post-button">
                Post Your First Project
              </Link>
            </div>
          ) : (
            <div className="my-projects-grid">

              {projects.map(function(project) {
                const status = project.status || "unknown";
                const workflow = workflowByJob[String(project.id)];
                const presentation = getAcceptedWorkPresentation({
                  applicationStatus: workflow?.applicationStatus,
                  jobStatus: status,
                  contractStatus: workflow?.contractStatus
                });

                return (
                  <article className="my-project-card" key={project.id}>

                    <div className="my-project-card-top">
                      <span className="my-project-category">
                        {project.category || "General"}
                      </span>

                      <span className={"my-project-status " + status}>
                        {status}
                      </span>
                    </div>

                    <h3>{project.title}</h3>

                    {presentation && <div className="project-work-status" aria-label="Hiring and contract status">
                      <strong>{presentation.label}</strong>
                      <p>{presentation.detail}</p>
                      {workflow?.contractId && <Link to={`/contracts/${encodeURIComponent(workflow.contractId)}`}>Open Contract Workroom</Link>}
                    </div>}

                    <p className="my-project-description">
                      {project.description || "No description provided."}
                    </p>

                    <div className="my-project-details">

                      <div>
                        <span>Budget</span>
                        <strong>
                          {project.currency || "USD"} {project.budget}
                        </strong>
                      </div>

                      <div>
                        <span>Payment Type</span>
                        <strong>
                          {project.payment_type || "Fixed Price"}
                        </strong>
                      </div>

                    </div>

                    {project.skills && (
                      <div className="my-project-skills">
                        <span>Required Skills</span>
                        <p>{project.skills}</p>
                      </div>
                    )}

                    <div className="my-project-date">
                      Posted: {
                        project.created_at
                          ? new Date(project.created_at).toLocaleDateString()
                          : "Date unavailable"
                      }
                    </div>

                    <div className="my-project-actions">
                      <Link
                        to={"/jobs/" + project.id}
                        className="my-project-view-button"
                      >
                        View Project
                      </Link>

                      <button
                        type="button"
                        className="my-project-edit-button"
                        onClick={function() {
                          startEdit(project);
                        }}
                      >
                        Edit
                      </button>
                      {status === "open" && (
                        <button type="button" className="my-project-edit-button" disabled={Boolean(pendingAction)} onClick={() => completeProject(project)}>
                          {pendingAction === "complete:" + String(project.id) ? "Completing…" : "Mark complete"}
                        </button>
                      )}
                        <button
                        type="button"
                        className="my-project-delete-button"
                        disabled={Boolean(pendingAction)}
                        onClick={function() {
                          deleteProject(project);
                        }}
                      >
                        {pendingAction === "delete:" + String(project.id) ? "Deleting…" : "Delete"}
                      </button>
                    </div>

                  </article>
                );
              })}

            </div>
          )}

        </section>

      </main>
    </div>
  );
}

export default MyProjects;
