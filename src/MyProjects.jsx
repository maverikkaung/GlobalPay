import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getCurrentUser } from "./auth.js";

function MyProjects() {
  const user = getCurrentUser();

  const [projects, setProjects] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [budget, setBudget] = useState("");
  const [paymentType, setPaymentType] = useState("Fixed Price");

  useEffect(function() {
    if (!user || user.accountType !== "Client") {
      return;
    }

    try {
      const savedJobs = JSON.parse(
        localStorage.getItem("globalpay_client_jobs") || "[]"
      );

      const myProjects = savedJobs.filter(function(item) {
        return item.clientEmail === user.email;
      });

      setProjects(myProjects);
    } catch (error) {
      setProjects([]);
    }
  }, []);

  function startEdit(project) {
    setEditingId(project.id);
    setTitle(project.title || "");
    setCategory(project.category || "");
    setDescription(project.description || "");
    setSkills(project.skills || "");
    setBudget(project.budget || "");
    setPaymentType(project.paymentType || "Fixed Price");

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

  function saveEdit(event) {
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

    const savedJobs = JSON.parse(
      localStorage.getItem("globalpay_client_jobs") || "[]"
    );

    const updatedJobs = savedJobs.map(function(item) {
      if (
        String(item.id) === String(editingId) &&
        item.clientEmail === user.email
      ) {
        return {
          ...item,
          title: title,
          category: category,
          description: description,
          skills: skills,
          budget: Number(budget),
          salary: "$" + budget + " USD",
          paymentType: paymentType
        };
      }

      return item;
    });

    localStorage.setItem(
      "globalpay_client_jobs",
      JSON.stringify(updatedJobs)
    );

    const myProjects = updatedJobs.filter(function(item) {
      return item.clientEmail === user.email;
    });

    setProjects(myProjects);
    cancelEdit();

    alert("Project updated successfully!");
  }

  function deleteProject(project) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this project?"
    );

    if (!confirmDelete) {
      return;
    }

    const savedJobs = JSON.parse(
      localStorage.getItem("globalpay_client_jobs") || "[]"
    );

    const updatedJobs = savedJobs.filter(function(item) {
      return !(
        String(item.id) === String(project.id) &&
        item.clientEmail === user.email
      );
    });

    localStorage.setItem(
      "globalpay_client_jobs",
      JSON.stringify(updatedJobs)
    );

    const savedApplications = JSON.parse(
      localStorage.getItem("globalpay_applications") || "[]"
    );

    const updatedApplications = savedApplications.filter(function(item) {
      return !(
        String(item.id) === String(project.id) &&
        item.clientEmail === user.email
      );
    });

    localStorage.setItem(
      "globalpay_applications",
      JSON.stringify(updatedApplications)
    );

    setProjects(updatedJobs.filter(function(item) {
      return item.clientEmail === user.email;
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
          GlobalPay
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

              <button type="submit">
                Save Changes
              </button>

              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>

            </form>
          </section>
        )}

        <section className="dashboard-section">
          <h2>My Posted Projects ({projects.length})</h2>

          {projects.length === 0 ? (
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
                    <p>{project.company}</p>
                    <p>Category: {project.category}</p>
                    <p>Budget: {project.salary}</p>
                    <p>Payment: {project.paymentType}</p>
                    <p>Status: {project.status}</p>
                    <p>Posted: {project.createdAt}</p>

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