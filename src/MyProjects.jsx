import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "./auth.js";
import { supabase } from "./supabase.js";

function MyProjects() {
  const user = getCurrentUser();

  const [projects, setProjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [budget, setBudget] = useState("");
  const [paymentType, setPaymentType] = useState("Fixed Price");

  useEffect(function() {
    async function loadProjects() {
      if (!user || user.accountType !== "Client" || !user.id) {
        setLoading(false);
        return;
      }

      const result = await supabase
        .from("jobs")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (result.error) {
        console.error(result.error);
        alert("Unable to load projects: " + result.error.message);
        setProjects([]);
      } else {
        setProjects(result.data);
      }

      setLoading(false);
    }

    loadProjects();
  }, [user ? user.id : null]);

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
      alert("Please complete all required fields.");
      return;
    }

    setSaving(true);

    const result = await supabase
      .from("jobs")
      .update({
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        skills: skills.trim(),
        budget: Number(budget),
        payment_type: paymentType
      })
      .eq("id", editingId)
      .eq("client_id", user.id);

    setSaving(false);

    if (result.error) {
      alert("Project update failed: " + result.error.message);
      return;
    }

    const updatedProjects = projects.map(function(item) {
      if (String(item.id) === String(editingId)) {
        return {
          ...item,
          title: title.trim(),
          category: category.trim(),
          description: description.trim(),
          skills: skills.trim(),
          budget: Number(budget),
          payment_type: paymentType
        };
      }

      return item;
    });

    setProjects(updatedProjects);
    cancelEdit();
    alert("Project updated successfully!");
  }

  async function deleteProject(project) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmDelete) {
      return;
    }

    const result = await supabase
      .from("jobs")
      .delete()
      .eq("id", project.id)
      .eq("client_id", user.id);

    if (result.error) {
      alert("Project deletion failed: " + result.error.message);
      return;
    }

    setProjects(projects.filter(function(item) {
      return String(item.id) !== String(project.id);
    }));

    alert("Project deleted successfully!");
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

      <header className="dashboard-navbar">
        <Link to="/" className="dashboard-logo">
          TechKarvo
        </Link>

        <Link to="/client-dashboard" className="dashboard-logout">
          Back to Dashboard
        </Link>
      </header>

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

        {editingId !== null && (
          <section className="my-projects-edit-section">
            <div className="my-projects-section-heading">
              <div>
                <span>PROJECT SETTINGS</span>
                <h2>Edit Project</h2>
              </div>
            </div>

            <form onSubmit={saveEdit} className="auth-form">

              <label>Job Title</label>
              <input
                type="text"
                value={title}
                onChange={function(event) {
                  setTitle(event.target.value);
                }}
                required
              />

              <label>Category</label>
              <input
                type="text"
                value={category}
                onChange={function(event) {
                  setCategory(event.target.value);
                }}
                required
              />

              <label>Description</label>
              <textarea
                value={description}
                onChange={function(event) {
                  setDescription(event.target.value);
                }}
                required
              />

              <label>Required Skills</label>
              <input
                type="text"
                value={skills}
                onChange={function(event) {
                  setSkills(event.target.value);
                }}
              />

              <label>Budget (USD)</label>
              <input
                type="number"
                min="1"
                value={budget}
                onChange={function(event) {
                  setBudget(event.target.value);
                }}
                required
              />

              <label>Payment Type</label>
              <select
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
                        <button
                        type="button"
                        className="my-project-delete-button"
                        onClick={function() {
                          deleteProject(project);
                        }}
                      >
                        Delete
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