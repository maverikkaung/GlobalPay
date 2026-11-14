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
      if (!user) {
        setLoading(false);
        return;
      }

      if (user.accountType !== "Client") {
        setLoading(false);
        return;
      }

      if (!user.id) {
        setLoading(false);
        alert("User ID not found. Please log in again.");
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
    setTitle(project.title);
    setCategory(project.category ? project.category : "");
    setDescription(project.description ? project.description : "");
    setSkills(project.skills ? project.skills : "");
    setBudget(String(project.budget));
    setPaymentType(
      project.payment_type ? project.payment_type : "Fixed Price"
    );

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
      budget === ""
    ) {
      alert("Please complete all required fields.");
      return;
    }

    setSaving(true);

    const result = await supabase
      .from("jobs")
      .update({
        title: title.trim(),
        category: category,
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
          category: category,
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
          <span className="dashboard-tag">CLIENT PROJECTS</span>
          <h1>My Projects</h1>
          <p>View and manage the jobs you have posted.</p>
        </div>

        {editingId !== null && (
          <section className="dashboard-section">
            <h2>Edit Project</h2>

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

        <section className="dashboard-section">
          <h2>My Posted Projects ({projects.length})</h2>

          {loading ? (
            <div className="dashboard-stat-card">
              <p>Loading your projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="dashboard-stat-card">
              <h3>No Projects Yet</h3>
              <p>You have not posted any jobs yet.</p>
              <Link to="/post-job">Post Your First Job</Link>
            </div>
          ) : (
            <div className="jobs-grid">

              {projects.map(function(project) {
                return (
                  <div className="job-card" key={project.id}>

                    <h3>{project.title}</h3>

                    <p>Category: {project.category}</p>

                    <p>
                      Budget: ${project.budget} {project.currency}
                    </p>
                       <p>
                      Payment: {project.payment_type}
                    </p>

                    <p>Status: {project.status}</p>

                    <p>
                      Posted: {
                        new Date(project.created_at).toLocaleDateString()
                      }
                    </p>

                    <Link to={"/jobs/" + project.id}>
                      View Project
                    </Link>

                    <button
                      type="button"
                      onClick={function() {
                        startEdit(project);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={function() {
                        deleteProject(project);
                      }}
                    >
                      Delete
                    </button>

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

export default MyProjects;