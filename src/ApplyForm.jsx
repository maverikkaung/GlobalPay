import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";

function ApplyForm() {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const accountType = user ? user.accountType : null;
  const userName = user ? user.name || "" : "";
  const userEmail = user ? user.email || "" : "";

  const [job, setJob] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState(userName);
  const [email] = useState(userEmail);
  const [country, setCountry] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [salary, setSalary] = useState("");
  const [salaryType, setSalaryType] = useState("Fixed Price");
  const [portfolio, setPortfolio] = useState("");

  useEffect(function() {
    async function loadData() {
      if (accountType !== "Freelancer" || !userId) {
        setPageLoading(false);
        return;
      }

      try {
        const jobResult = await supabase
          .from("jobs")
          .select("*")
          .eq("id", params.id)
          .eq("status", "open")
          .maybeSingle();

        if (jobResult.error) {
          console.log("Job loading error:", jobResult.error.message);
          setJob(null);
          setPageLoading(false);
          return;
        }

        if (!jobResult.data) {
          setJob(null);
          setPageLoading(false);
          return;
        }

        const item = jobResult.data;

        setJob({
          id: item.id,
          title: item.title,
          budget: item.budget,
          currency: item.currency || "USD",
          paymentType: item.payment_type || "Fixed Price",
          clientId: item.client_id
        });

        const profileResult = await supabase
          .from("profiles")
          .select("full_name, country, professional_title, bio, skills, experience, portfolio_url")
          .eq("id", userId)
          .maybeSingle();

        if (profileResult.data) {
          const profile = profileResult.data;

          setFullName(profile.full_name || userName);
          setCountry(profile.country || "");
          setTitle(profile.professional_title || "");
          setBio(profile.bio || "");
          setSkills(profile.skills || "");
          setExperience(profile.experience || "");
          setPortfolio(profile.portfolio_url || "");
        }
      } catch (error) {
        console.log("Application page error:", error.message);
        setJob(null);
      }

      setPageLoading(false);
    }

    loadData();
  }, [params.id, accountType, userId, userEmail, userName]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      alert("Please log in first.");
      navigate("/login");
      return;
    }

    if (user.accountType !== "Freelancer") {
      alert("Only Freelancers can apply for jobs.");
      return;
    }

    if (!user.id) {
      alert("User ID not found. Please log out and log in again.");
      return;
    }

    if (!job) {
      alert("This job is not available.");
      return;
    }

    if (Number(salary) <= 0) {
      alert("Please enter a valid expected salary.");
      return;
    }

    setSubmitting(true);
      const application = {
      job_id: job.id,
      client_id: job.clientId,
      freelancer_id: user.id,
      full_name: fullName.trim(),
      email: email.trim(),
      country: country.trim(),
      professional_title: title.trim(),
      bio: bio.trim(),
      skills: skills.trim(),
      experience: experience,
      cover_letter: coverLetter.trim(),
      expected_salary: Number(salary),
      salary_type: salaryType,
      portfolio: portfolio.trim(),
      status: "Pending"
    };

    const result = await supabase
      .from("job_applications")
      .insert(application);

    setSubmitting(false);

    if (result.error) {
      if (result.error.code === "23505") {
        alert("You have already applied for this job.");
        navigate("/my-applications");
        return;
      }

      alert("Application submission failed: " + result.error.message);
      return;
    }

    alert("Your application has been submitted successfully!");
    navigate("/my-applications");
  }

  if (!user) {
    return (
      <div className="dashboard-page">
        <h2>Please log in to apply.</h2>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  if (user.accountType !== "Freelancer") {
    return (
      <div className="dashboard-page">
        <h2>Only Freelancers can apply for jobs.</h2>
        <Link to="/client-dashboard">Back to Dashboard</Link>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="dashboard-page">
        <h2>Loading Application Form...</h2>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="dashboard-page">
        <h2>Job not found or no longer available.</h2>
        <Link to="/jobs">Back to Jobs</Link>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to="/jobs" className="dashboard-logo">
          TechKarvo
        </Link>

        <Link to="/jobs" className="dashboard-logout">
          Back to Jobs
        </Link>
      </header>

      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">JOB APPLICATION</span>
          <h1>Apply for {job.title}</h1>
          <p>
            {job.currency} {job.budget} · {job.paymentType}
          </p>
        </div>

        <form className="application-form" onSubmit={handleSubmit}>
          <h2>Personal Information</h2>

          <label>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={function(event) {
              setFullName(event.target.value);
            }}
            required
          />

          <label>Email Address</label>
          <input
            type="email"
            value={email}
            disabled
            required
          />

          <label>Country / City</label>
          <input
            type="text"
            placeholder="Example: Yangon, Myanmar"
            value={country}
            onChange={function(event) {
              setCountry(event.target.value);
            }}
            required
          />

          <h2>Professional Profile</h2>

          <label>Professional Title</label>
          <input
            type="text"
            placeholder="Example: Frontend Developer"
            value={title}
            onChange={function(event) {
              setTitle(event.target.value);
            }}
            required
          />

          <label>About Me</label>
          <textarea
            placeholder="Tell the client about yourself..."
            value={bio}
            onChange={function(event) {
              setBio(event.target.value);
            }}
            required
          />

          <label>Skills</label>
          <input
            type="text"
            placeholder="React, JavaScript, CSS..."
            value={skills}
            onChange={function(event) {
              setSkills(event.target.value);
            }}
            required
          />
        <label>Years of Experience</label>
          <select
            value={experience}
            onChange={function(event) {
              setExperience(event.target.value);
            }}
            required
          >
            <option value="">Select Experience</option>
            <option value="Beginner">Beginner</option>
            <option value="Less than 1 year">Less than 1 year</option>
            <option value="1-2 years">1-2 years</option>
            <option value="3-5 years">3-5 years</option>
            <option value="5+ years">5+ years</option>
          </select>

          <h2>Job Application</h2>

          <label>Cover Letter</label>
          <textarea
            placeholder="Why are you suitable for this job?"
            value={coverLetter}
            onChange={function(event) {
              setCoverLetter(event.target.value);
            }}
            required
          />

          <label>Expected Salary (USD)</label>
          <input
            type="number"
            min="1"
            placeholder="Example: 800"
            value={salary}
            onChange={function(event) {
              setSalary(event.target.value);
            }}
            required
          />

          <label>Salary Type</label>
          <select
            value={salaryType}
            onChange={function(event) {
              setSalaryType(event.target.value);
            }}
          >
            <option value="Fixed Price">Fixed Price</option>
            <option value="Hourly">Hourly</option>
          </select>

          <label>Portfolio / LinkedIn URL</label>
          <input
            type="url"
            placeholder="https://example.com"
            value={portfolio}
            onChange={function(event) {
              setPortfolio(event.target.value);
            }}
          />

          <button
            type="submit"
            className="primary-btn"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default ApplyForm;
