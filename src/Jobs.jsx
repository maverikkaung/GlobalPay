import { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "./auth.js";
import { supabase } from "./supabase.js";
import "./App.css";

export const jobsData = [
  {
    id: 1,
    title: "Frontend React Developer",
    company: "Tech Solutions",
    location: "Remote",
    type: "Full-time",
    category: "Web Development",
    salary: "$800 - $1,500",
    description: "We are looking for a React developer to build modern and responsive web applications.",
    skills: ["React", "JavaScript", "CSS", "HTML"]
  },
  {
    id: 2,
    title: "UI/UX Designer",
    company: "Creative Studio",
    location: "Remote",
    type: "Part-time",
    category: "Design",
    salary: "$500 - $1,000",
    description: "Design beautiful and user-friendly interfaces for web and mobile applications.",
    skills: ["Figma", "UI Design", "UX Design"]
  },
  {
    id: 3,
    title: "Content Writer",
    company: "Global Media",
    location: "Remote",
    type: "Freelance",
    category: "Writing",
    salary: "$300 - $700",
    description: "Create engaging articles, blog posts, and website content.",
    skills: ["Writing", "Research", "SEO"]
  },
  {
    id: 4,
    title: "Digital Marketing Specialist",
    company: "Growth Agency",
    location: "Remote",
    type: "Full-time",
    category: "Marketing",
    salary: "$600 - $1,200",
    description: "Manage digital marketing campaigns and help businesses grow online.",
    skills: ["SEO", "Social Media", "Marketing"]
  }
];

function Jobs() {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [clientJobs, setClientJobs] = useState([]);
  const [supabaseJobs, setSupabaseJobs] = useState([]);

  useEffect(() => {
    async function loadJobs() {
      const result = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (result.error) {
        console.log("Jobs Loading Error:", result.error.message);
        setSupabaseJobs([]);
        return;
      }

      const formattedJobs = result.data.map(function(item) {
        return {
          id: item.id,
          title: item.title,
          company: "TechKarvo Client",
          location: "Remote",
          type: "Freelance",
          category: "Other",
          salary: String(item.currency ? item.currency : "USD") + " " + String(item.budget),
          description: item.description,
          skills: []
        };
      });

      setSupabaseJobs(formattedJobs);
      console.log("Supabase Jobs Loaded:", formattedJobs);
    }

    loadJobs();

    try {
      const savedData = localStorage.getItem("TechKarvo_client_jobs");
      const savedJobs = savedData ? JSON.parse(savedData) : [];

      const formattedLocalJobs = savedJobs.map(function(item) {
        let jobSkills = [];

        if (Array.isArray(item.skills)) {
          jobSkills = item.skills;
        } else {
          jobSkills = String(item.skills ? item.skills : "").split(",");
        }

        return {
          ...item,
          skills: jobSkills.map(function(skill) {
            return skill.trim();
          }).filter(Boolean)
        };
      });

      setClientJobs(formattedLocalJobs);
    } catch (error) {
      setClientJobs([]);
    }
  }, []);

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

  const allJobs = jobsData.concat(clientJobs).concat(supabaseJobs);

  function handleApply(job) {
    const user = getCurrentUser();

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

        <div className="jobs-nav-links">
          <NavLink to="/" end>Home</NavLink>
          <Link to="/#features">Features</Link>
          <Link to="/#about">About</Link>
          <NavLink to="/jobs">Find Jobs</NavLink>
        </div>

        <div className="nav-buttons">
          <Link to="/login" className="login-btn">Login</Link>
          <Link to="/signup" className="signup-btn">Sign Up</Link>
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
              {filteredJobs.length} Jobs Found
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
            {filteredJobs.length > 0 ? (
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
                  Try another search keyword or category.
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