import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import "./App.css";

import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";
import Jobs from "./Jobs.jsx";
import JobDetails from "./JobDetails.jsx";
import FreelancerDashboard from "./FreelancerDashboard.jsx";
import ClientDashboard from "./ClientDashboard.jsx";
import MyApplications from "./MyApplications.jsx";
import ApplyForm from "./ApplyForm.jsx";
import FreelancerProfile from "./FreelancerProfile.jsx";
import PostJob from "./PostJob.jsx";
import JobApplicants from "./JobApplicants.jsx";
import MyFreelancers from "./MyFreelancers.jsx";
import MyProjects from "./MyProjects.jsx";


function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const section = document.getElementById(
        location.hash.substring(1)
      );

      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return (
    <div className="website home-redesign">

      {/* NAVBAR */}

      <header className="navbar">

        <Link to="/" className="logo">
          Global<span>Pay</span>
        </Link>

        <div className={"nav-links " + (menuOpen ? "active" : "")}>

          <Link
            to="/#home"
            className={
              location.hash === "" || location.hash === "#home"
                ? "active"
                : ""
            }
            onClick={() => setMenuOpen(false)}
          >
            Home
          </Link>

          <Link
            to="/#features"
            className={location.hash === "#features" ? "active" : ""}
            onClick={() => setMenuOpen(false)}
          >
            Features
          </Link>

          <Link
            to="/jobs"
            onClick={() => setMenuOpen(false)}
          >
            Find Jobs
          </Link>

          <Link
            to="/#about"
            className={location.hash === "#about" ? "active" : ""}
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>

        </div>

        <div className="nav-buttons">

          <Link to="/login" className="login-btn">
            Log In
          </Link>

          <Link to="/signup" className="signup-btn">
            Get Started
          </Link>

        </div>

        <button
          className="menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>

      </header>


      {/* HOMEPAGE HERO */}

      <main id="home">

        <section className="hero home-hero">

          <div className="hero-content home-hero-content">

            <div className="tag home-tag">
              YOUR GLOBAL FREELANCE JOURNEY STARTS HERE
            </div>

            <h1>
              Work Without
              <br />
              <span>Boundaries.</span>
              <br />
              Earn Globally.
            </h1>

            <p>
              Discover opportunities, connect with talented people,
              and build your career beyond borders with GlobalPay.
            </p>

            <div className="hero-buttons">

              <Link to="/jobs" className="primary-btn">
                Explore Jobs →
              </Link>

              <Link to="/signup" className="secondary-btn">
                Become a Freelancer
              </Link>

            </div>

            <div className="trust">
              <span>✓</span>
              One platform for global freelance opportunities.
            </div>

          </div>


          {/* PREVIEW CARD */}

          <div className="wallet-card home-preview-card">

            <div className="card-top">
              <span>GLOBALPAY OVERVIEW</span>
              <span className="preview-status">PREVIEW</span>
            </div>
<div className="balance-label">
              Your Global Career
            </div>

            <h2>Start Here.</h2>

            <div className="balance-note">
              Find opportunities and grow your skills.
            </div>

            <div className="preview-divider"></div>

            <div className="preview-stats">

              <div>
                <span>Find</span>
                <strong>Jobs</strong>
              </div>

              <div>
                <span>Build</span>
                <strong>Profile</strong>
              </div>

              <div>
                <span>Grow</span>
                <strong>Career</strong>
              </div>

            </div>

            <Link to="/jobs" className="preview-action">
              Explore Opportunities →
            </Link>

            <div className="card-bottom">
              <span>GLOBAL OPPORTUNITIES</span>
              <span>GLOBALPAY</span>
            </div>

          </div>

        </section>


        {/* FEATURES */}

        <section id="features" className="features home-features">

          <div className="home-section-heading">

            <span>WHY GLOBALPAY</span>

            <h2>Everything You Need to Grow</h2>

            <p>
              Discover opportunities and take your freelance career
              to the next level.
            </p>

          </div>


          <div className="home-feature-grid">

            <div className="home-feature-card">

              <div className="feature-icon">🌍</div>

              <h3>Global Opportunities</h3>

              <p>
                Explore remote jobs and connect with clients
                from different parts of the world.
              </p>

            </div>


            <div className="home-feature-card">

              <div className="feature-icon">💼</div>

              <h3>Career Development</h3>

              <p>
                Build your professional profile, showcase your
                skills, and find projects that match your goals.
              </p>

            </div>


            <div className="home-feature-card">

              <div className="feature-icon">🔒</div>

              <h3>Platform Security</h3>

              <p>
                Our platform is designed with security and
                reliable user experiences in mind.
              </p>

            </div>

          </div>

        </section>


        {/* CALL TO ACTION */}

        <section id="about" className="bottom-cta home-cta">

          <span>YOUR NEXT OPPORTUNITY IS WAITING</span>

          <h2>Ready to Go Global?</h2>

          <p>
            Your skills deserve a global audience.
            Start building your future with GlobalPay.
          </p>

          <Link to="/signup" className="primary-btn">
            Create Your Account →
          </Link>

        </section>

      </main>


      {/* FOOTER */}

      <footer className="home-footer">

        <Link to="/" className="logo">
          Global<span>Pay</span>
        </Link>

        <p>
          © 2026 GlobalPay. All rights reserved.
        </p>

        <span>
          Connecting Talent Across Borders.
        </span>

      </footer>

    </div>
  );
}


function App() {
  return (
    <Routes>

      <Route path="/" element={<Home />} />

      <Route path="/login" element={<Login />} />

      <Route path="/signup" element={<Signup />} />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route path="/jobs" element={<Jobs />} />

      <Route path="/jobs/:id" element={<JobDetails />} />

      <Route
        path="/freelancer-dashboard"
        element={<FreelancerDashboard />}
      />

      <Route
        path="/client-dashboard"
        element={<ClientDashboard />}
      />

      <Route
        path="/my-applications"
        element={<MyApplications />}
      />

      <Route path="/apply/:id" element={<ApplyForm />} />
<Route
        path="/freelancer-profile"
        element={<FreelancerProfile />}
      />

      <Route path="/post-job" element={<PostJob />} />

      <Route
        path="/job-applicants"
        element={<JobApplicants />}
      />

      <Route
        path="/my-freelancers"
        element={<MyFreelancers />}
      />

      <Route
        path="/my-projects"
        element={<MyProjects />}
      />

    </Routes>
  );
}

export default App;