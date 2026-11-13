import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser } from "./auth.js";

function FreelancerProfile() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [fullName, setFullName] = useState(user ? user.name : "");
  const [country, setCountry] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [portfolio, setPortfolio] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (user.accountType !== "Freelancer") {
      navigate("/client-dashboard");
      return;
    }

    try {
      const allProfiles = JSON.parse(
        localStorage.getItem("TechKarvo_freelancer_profiles") || "{}"
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
    } catch {
      console.log("Could not load profile.");
    }
  }, []);

  function handleSave(event) {
    event.preventDefault();

    if (!user) {
      navigate("/login");
      return;
    }

    let allProfiles = {};

    try {
      allProfiles = JSON.parse(
        localStorage.getItem("TechKarvo_freelancer_profiles") || "{}"
      );
    } catch {
      allProfiles = {};
    }

    allProfiles[user.email] = {
      fullName: fullName,
      country: country,
      title: title,
      bio: bio,
      skills: skills,
      experience: experience,
      portfolio: portfolio
    };

    localStorage.setItem(
      "TechKarvo_freelancer_profiles",
      JSON.stringify(allProfiles)
    );

    alert("Your profile has been saved successfully!");
  }

  if (!user || user.accountType !== "Freelancer") {
    return null;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to="/freelancer-dashboard" className="dashboard-logo">
          TechKarvo
        </Link>

        <Link
          to="/freelancer-dashboard"
          className="dashboard-logout"
        >
          Back to Dashboard
        </Link>
      </header>

      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">FREELANCER PROFILE</span>
          <h1>My Professional Profile</h1>
          <p>Tell clients about your experience and skills.</p>
        </div>

        <form className="application-form" onSubmit={handleSave}>
          <h2>Personal Information</h2>

          <label>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label>Country / City</label>
          <input
            type="text"
            placeholder="Example: Yangon, Myanmar"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            required
          />

          <h2>Professional Information</h2>

          <label>Professional Title</label>
          <input
            type="text"
            placeholder="Example: Frontend Developer"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />

          <label>About Me</label>
          <textarea
            placeholder="Tell clients about yourself..."
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            required
          />
<label>Skills</label>
          <input
            type="text"
            placeholder="React, JavaScript, CSS..."
            value={skills}
            onChange={(event) => setSkills(event.target.value)}
            required
          />

          <label>Years of Experience</label>
          <select
            value={experience}
            onChange={(event) => setExperience(event.target.value)}
            required
          >
            <option value="">Select Experience</option>
            <option value="Beginner">Beginner</option>
            <option value="Less than 1 year">Less than 1 year</option>
            <option value="1-2 years">1-2 years</option>
            <option value="3-5 years">3-5 years</option>
            <option value="5+ years">5+ years</option>
          </select>

          <label>Portfolio / LinkedIn URL</label>
          <input
            type="url"
            placeholder="https://example.com"
            value={portfolio}
            onChange={(event) => setPortfolio(event.target.value)}
          />

          <button type="submit" className="primary-btn">
            Save Profile
          </button>
        </form>
      </main>
    </div>
  );
}

export default FreelancerProfile;