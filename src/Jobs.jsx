import { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { parseSkills } from "./marketplace.js";
import "./App.css";

function Jobs() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
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

      const formattedJobs = result.data.map(function(item) {
        return {
          id: item.id,
          title: item.title,
          company: "TechKarvo Client",
          location: "Remote",
          type: item.payment_type || "Freelance",
          category: item.category || "Other",
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
  }, [loadAttempt]);

  const categories = [
    "All",
    "Web Development",
    "Design",
    "Writing",
    "Marketing",
    "Graphic Design",
    "Video Editing",
    "Other"
  ];

  const allJobs = supabaseJobs;

  function handleApply(job) {
    if (!user) {
      alert("Please log in to apply for this job.");
      navigate("/login");
      return;
    }

    if (user.accountType !== "Freelancer") {
      alert("Only freelancers can apply for jobs.");
      return;
    }

    navigate("/apply/" + job.id);
  }
    const filteredJobs = allJobs.filter(function(job) {
    const search = searchTerm.toLowerCase();

    const title = String(job.title ? job.title : "").toLowerCase();
    const company = String(job.company ? job.company : "").toLowerCase();
    const description = String(job.description ? job.description : "").toLowerCase();

    const searchItems = [title, company, description];

    if (Array.isArray(job.skills)) {
      job.skills.forEach(function(skill) {
        searchItems.push(String(skill).toLowerCase());
      });
    }

    const matchesSearch = searchItems.some(function(value) {
      return value.includes(search);
    });

    const matchesCategory =
      selectedCategory === "All" ? true : job.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="jobs-page">
      <nav className="jobs-navbar">
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
      </nav>

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

          <div className="jobs-search">
            <input
              type="text"
              placeholder="Search jobs or companies..."
              value={searchTerm}
              onChange={function(event) {
                setSearchTerm(event.target.value);
              }}
            />

            <button type="button">
              Search
            </button>
          </div>
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

            <span className="jobs-count">
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
                  onClick={function() {
                    setSelectedCategory(category);
                  }}
                >
                  {category}
                </button>
              );
            })}
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
                      {job.company}
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
