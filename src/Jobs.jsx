import { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getJobCategories, matchesJobSearch, parseSkills } from "./marketplace.js";
import DashboardNav from "./DashboardNav.jsx";
import "./App.css";

function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const currentUserId = user?.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortMode, setSortMode] = useState("newest");
  const [supabaseJobs, setSupabaseJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadJobs() {
      setJobsLoading(true);
      setJobsError("");
      let result;
      try {
        result = await supabase
          .from("jobs")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false });
      } catch (error) {
        if (!active) return;
        console.error("Jobs loading failed:", error);
        setJobsError("We couldn't load jobs right now. Please try again.");
        setSupabaseJobs([]);
        setJobsLoading(false);
        return;
      }

      if (!active) return;
      if (result.error) {
        console.error("Jobs loading failed:", result.error.message);
        setJobsError("We couldn't load jobs right now. Please try again.");
        setSupabaseJobs([]);
        setJobsLoading(false);
        return;
      }

      const clientNames = new Map();
      const clientIds = [...new Set(result.data.map((item) => item.client_id).filter(Boolean))];
      if (isAuthenticated && clientIds.length > 0) {
        try {
          const clientsResult = await supabase.from("client_public_profiles")
            .select("id, full_name").in("id", clientIds);
          if (clientsResult.error) {
            console.error("Client profile lookup failed:", clientsResult.error.message);
          } else {
            (clientsResult.data || []).forEach((profile) => {
              if (profile.full_name) clientNames.set(profile.id, profile.full_name);
            });
          }
        } catch (error) {
          console.error("Client profile lookup failed:", error);
        }
      }
      if (!active) return;

      const formattedJobs = result.data.map(function(item) {
        return {
          id: item.id,
          clientId: item.client_id,
          title: item.title,
          company: clientNames.get(item.client_id) || "TechKarvo Client",
          location: "Remote",
          type: item.payment_type || "Freelance",
          category: item.category || "Other",
          createdAt: item.created_at,
          budget: Number(item.budget) || 0,
          salary: String(item.currency ? item.currency : "USD") + " " + String(item.budget),
          description: item.description,
          skills: parseSkills(item.skills)
        };
      });

      setSupabaseJobs(formattedJobs);
      setJobsLoading(false);
    }

    loadJobs();
    return () => { active = false; };
  }, [loadAttempt, isAuthenticated, currentUserId]);

  const categories = getJobCategories(supabaseJobs);

  const allJobs = supabaseJobs;
  function applySearch(event) {
    event.preventDefault();
    setAppliedSearchTerm(searchTerm.trim());
  }

  function handleApply(job) {
    if (!user) {
      navigate("/login", { state: { from: "/apply/" + job.id } });
      return;
    }

    if (user.accountType !== "Freelancer") {
      navigate("/client-dashboard");
      return;
    }

    navigate("/apply/" + job.id);
  }
  const filteredJobs = allJobs.filter(function(job) {
    const matchesCategory =
      selectedCategory === "All" ? true : job.category === selectedCategory;

    return matchesJobSearch(job, appliedSearchTerm) && matchesCategory;
  }).sort((first, second) => sortMode === "title"
    ? first.title.localeCompare(second.title)
    : new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime());
  const hasActiveFilters = Boolean(appliedSearchTerm || selectedCategory !== "All");

  return (
    <div className="jobs-page">
      {user ? <DashboardNav user={user} /> : <nav className="jobs-navbar">
        <Link to="/" className="logo">
          TechKarvo
        </Link>

        <nav aria-label="Main navigation" className="jobs-nav-links">
          <NavLink to="/" end>Home</NavLink>
          <Link to="/#features">Features</Link>
          <Link to="/#about">About</Link>
          <NavLink to="/jobs">Find Jobs</NavLink>
        </nav>

        <div className="nav-buttons">
          {user ? (
            <Link to={user.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard"} className="signup-btn">Dashboard</Link>
          ) : (
            <><Link to="/login" className="login-btn">Log In</Link><Link to="/signup" className="signup-btn">Sign Up</Link></>
          )}
        </div>
      </nav>}

      <section className="jobs-hero">
        <div className="jobs-hero-content">
          <span className="section-label">
            TechKarvo JOB MARKETPLACE
          </span>

          <h1>
            Find Your Next
            <span> Opportunity</span>
          </h1>

          <p>
            Discover remote jobs and connect with companies
            around the world.
          </p>

          <form className="jobs-search" role="search" onSubmit={applySearch}>
            <input
              type="search"
              aria-label="Search open jobs by title, client, description, or skill"
              placeholder="Search jobs or companies..."
              value={searchTerm}
              onChange={function(event) {
                setSearchTerm(event.target.value);
              }}
            />

            <button type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="jobs-list-section">
        <div className="jobs-container">
          <div className="jobs-heading">
            <div>
              <h2>Explore Jobs</h2>
              <p>
                Find opportunities that match your skills.
              </p>
            </div>

            <span className="jobs-count" aria-live="polite">
              {jobsLoading ? "Loading jobs…" : `${filteredJobs.length} Jobs Found`}
            </span>
          </div>

          <div className="job-categories">
            {categories.map(function(category) {
              return (
                <button
                  key={category}
                  type="button"
                  className={
                    selectedCategory === category ? "active" : ""
                  }
                  aria-pressed={selectedCategory === category}
                  onClick={function() {
                    setSelectedCategory(category);
                  }}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="jobs-results-controls">
            <p>{hasActiveFilters ? `Showing ${filteredJobs.length} matching ${filteredJobs.length === 1 ? "job" : "jobs"}` : "Browse all open opportunities"}</p>
            <div className="jobs-results-actions">
              {hasActiveFilters && <button type="button" className="clear-job-filters" onClick={() => {
                setSearchTerm("");
                setAppliedSearchTerm("");
                setSelectedCategory("All");
              }}>Clear filters</button>}
              <label className="jobs-sort-label" htmlFor="jobs-sort">Sort by
                <select id="jobs-sort" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                  <option value="newest">Most recent</option>
                  <option value="title">Title A to Z</option>
                </select>
              </label>
            </div>
          </div>

          <div className="jobs-grid">
            {jobsLoading ? (
              <div className="no-jobs" role="status"><h3>Loading opportunities</h3><p>Fetching the latest open jobs…</p></div>
            ) : jobsError ? (
              <div className="no-jobs" role="alert"><h3>Jobs unavailable</h3><p>{jobsError}</p><button type="button" className="apply-btn" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button></div>
            ) : filteredJobs.length > 0 ? (
              filteredJobs.map(function(job) {
                return (
                  <div className="job-card" key={job.id}>
                    <div className="job-card-top">
                      <div className="company-icon">
                        {(job.company ? job.company : "C").charAt(0)}
                      </div>

                      <span className="job-type">
                        {job.type ? job.type : "Freelance"}
                      </span>
                    </div>

                    <h3>{job.title}</h3>

                    <p className="job-company">
                      {user && job.clientId
                        ? <Link to={"/profiles/" + job.clientId}>{job.company}</Link>
                        : job.company}
                    </p>
                       <div className="job-info">
                      <span>{job.location ? job.location : "Remote"}</span>
                      <span>{job.salary}</span>
                    </div>

                    <p className="job-description">
                      {job.description}
                    </p>

                    <div className="job-skills">
                      {job.skills.map(function(skill, index) {
                        return (
                          <span key={index}>
                            {skill}
                          </span>
                        );
                      })}
                    </div>

                    <div className="job-card-actions">
                      <Link
                        to={"/jobs/" + job.id}
                        className="view-job-link"
                      >
                        View Details
                      </Link>

                      <button
                        type="button"
                        className="apply-btn"
                        onClick={function() {
                          handleApply(job);
                        }}
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-jobs">
                <h3>No Jobs Found</h3>
                <p>
                  {supabaseJobs.length ? "Try another search keyword or category." : "New opportunities will appear here when clients post them."}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="jobs-footer">
        <p>
          © 2026 TechKarvo. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default Jobs;
