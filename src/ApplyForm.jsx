import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCurrentUser } from "./auth.js";
import { jobsData } from "./Jobs.jsx";

function ApplyForm() {
  const navigate = useNavigate();
  const params = useParams();
  const user = getCurrentUser();

  let clientJobs = [];

  try {
    clientJobs = JSON.parse(
      localStorage.getItem("globalpay_client_jobs") || "[]"
    );
  } catch (error) {
    clientJobs = [];
  }

  const allJobs = jobsData.concat(clientJobs);

  const job = allJobs.find(function(item) {
    return String(item.id) === String(params.id);
  });

  const [fullName, setFullName] = useState(user ? user.name : "");
  const [email, setEmail] = useState(user ? user.email : "");
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
    if (!user) {
      return;
    }

    try {
      const allProfiles = JSON.parse(
        localStorage.getItem("globalpay_freelancer_profiles") || "{}"
      );

      const profile = allProfiles[user.email];

      if (profile) {
        setFullName(profile.fullName || user.name);
        setCountry(profile.country || "");
        setTitle(profile.title || "");
        setBio(profile.bio || "");
        setSkills(profile.skills || "");
        setExperience(profile.experience || "");
        setPortfolio(profile.portfolio || "");
      }
    } catch (error) {
      console.log("Could not load freelancer profile.");
    }
  }, []);

  function handleSubmit(event) {
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

    let savedApplications = [];

    try {
      savedApplications = JSON.parse(
        localStorage.getItem("globalpay_applications") || "[]"
      );
    } catch (error) {
      savedApplications = [];
    }

    const alreadyApplied = savedApplications.some(function(item) {
      return String(item.id) === String(job.id) &&
        item.email === user.email;
    });

    if (alreadyApplied) {
      alert("You have already applied for this job.");
      navigate("/my-applications");
      return;
    }

    const application = {
      id: job.id,
      title: job.title,
      company: job.company,
      clientEmail: job.clientEmail || "",
      email: user.email,
      fullName: fullName,
      country: country,
      professionalTitle: title,
      bio: bio,
      skills: skills,
      experience: experience,
      coverLetter: coverLetter,
      expectedSalary: salary,
      salaryType: salaryType,
      portfolio: portfolio,
      status: "Pending",
      appliedAt: new Date().toLocaleDateString()
    };

    savedApplications.push(application);

    localStorage.setItem(
      "globalpay_applications",
      JSON.stringify(savedApplications)
    );

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

  if (!job) {
    return (
      <div className="dashboard-page">
        <h2>Job not found.</h2>
        <Link to="/jobs">Back to Jobs</Link>
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

  return (
    <div className="dashboard-page">
<header className="dashboard-navbar">
        <Link to="/jobs" className="dashboard-logo">
          GlobalPay
        </Link>

        <Link to="/jobs" className="dashboard-logout">
          Back to Jobs
        </Link>
      </header>

      <main className="dashboard-container">

        <div className="dashboard-welcome">
          <span className="dashboard-tag">JOB APPLICATION</span>
          <h1>Apply for {job.title}</h1>
          <p>{job.company} · {job.salary || "Negotiable"}</p>
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
<button type="submit" className="primary-btn">
            Submit Application
          </button>

        </form>
      </main>
    </div>
  );
}

export default ApplyForm;