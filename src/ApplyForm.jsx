import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import DashboardNav from "./DashboardNav.jsx";
import { getMarketplaceWriteError } from "./marketplace-write-errors.js";

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
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

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
          console.error("Job loading error:", jobResult.error.message);
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
        console.error("Application page error:", error.message);
        setJob(null);
      }

      setPageLoading(false);
    }

    loadData();
  }, [params.id, accountType, userId, userEmail, userName]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login", { state: { from: "/apply/" + params.id } });
      return;
    }

    if (user.accountType !== "Freelancer") {
      setFormError("Only freelancers can apply for jobs.");
      return;
    }

    if (!user.id) {
      setFormError("We couldn't verify your account. Please sign out and sign in again.");
      return;
    }

    if (!job) {
      setFormError("This job is no longer available.");
      return;
    }

    if (!Number.isFinite(Number(salary)) || Number(salary) <= 0) {
      setFormError("Enter an expected salary greater than zero.");
      return;
    }

    setSubmitting(true);
    setFormError("");
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

    try {
      const result = await supabase.from("job_applications").insert(application);
      if (result.error) {
        if (result.error.code === "23505") {
          setFormError("You've already applied for this job. View your application in My Applications.");
          return;
        }
        setFormError(getMarketplaceWriteError(result.error, "We couldn't submit your application", "application"));
        console.error("Application submission failed:", result.error.message);
        return;
      }
      setFormSuccess(true);
    } catch (error) {
      console.error("Application submission failed:", error);
      setFormError("A network error interrupted submission. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
      <DashboardNav user={user} />

      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">JOB APPLICATION</span>
          <h1>Apply for {job.title}</h1>
          <p>
            {job.currency} {job.budget} · {job.paymentType}
          </p>
        </div>

        <form className="application-form" onSubmit={handleSubmit}>
          {formError && <p className="auth-notice auth-notice--error" role="alert">{formError} {formError.startsWith("You've already applied") && <Link to="/my-applications">Go to My Applications</Link>}</p>}
          {formSuccess && <p className="auth-notice auth-notice--success" role="status">Application submitted. <Link to="/my-applications">View your applications</Link>.</p>}
          <h2>Personal Information</h2>

          <label htmlFor="application-full-name">Full Name</label>
          <input
            id="application-full-name"
            type="text"
            value={fullName}
            onChange={function(event) {
              setFullName(event.target.value);
            }}
            required
          />

          <label htmlFor="application-email">Email Address</label>
          <input
            id="application-email"
            type="email"
            value={email}
            disabled
            required
          />

          <label htmlFor="application-country">Country / City</label>
          <input
            id="application-country"
            type="text"
            placeholder="Example: Yangon, Myanmar"
            value={country}
            onChange={function(event) {
              setCountry(event.target.value);
            }}
            required
          />

          <h2>Professional Profile</h2>

          <label htmlFor="application-title">Professional Title</label>
          <input
            id="application-title"
            type="text"
            placeholder="Example: Frontend Developer"
            value={title}
            onChange={function(event) {
              setTitle(event.target.value);
            }}
            required
          />

          <label htmlFor="application-bio">About Me</label>
          <textarea
            id="application-bio"
            placeholder="Tell the client about yourself..."
            value={bio}
            onChange={function(event) {
              setBio(event.target.value);
            }}
            required
          />

          <label htmlFor="application-skills">Skills</label>
          <input
            id="application-skills"
            type="text"
            placeholder="React, JavaScript, CSS..."
            value={skills}
            onChange={function(event) {
              setSkills(event.target.value);
            }}
            required
          />
          <label htmlFor="application-experience">Years of Experience</label>
          <select
            id="application-experience"
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

          <label htmlFor="application-cover-letter">Cover Letter</label>
          <textarea
            id="application-cover-letter"
            placeholder="Why are you suitable for this job?"
            value={coverLetter}
            onChange={function(event) {
              setCoverLetter(event.target.value);
            }}
            required
          />

          <label htmlFor="application-salary">Expected Salary (USD)</label>
          <input
            id="application-salary"
            type="number"
            min="1"
            placeholder="Example: 800"
            value={salary}
            onChange={function(event) {
              setSalary(event.target.value);
            }}
            required
          />

          <label htmlFor="application-salary-type">Salary Type</label>
          <select
            id="application-salary-type"
            value={salaryType}
            onChange={function(event) {
              setSalaryType(event.target.value);
            }}
          >
            <option value="Fixed Price">Fixed Price</option>
            <option value="Hourly">Hourly</option>
          </select>

          <label htmlFor="application-portfolio">Portfolio / LinkedIn URL</label>
          <input
            id="application-portfolio"
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
            disabled={submitting || formSuccess}
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default ApplyForm;
