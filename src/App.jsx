import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import "./App.css";
import { AuthProvider, RequireAuth } from "./AuthContext.jsx";
import { useAuth } from "./useAuth.js";
import { isSupabaseConfigured } from "./supabase.js";

const DashboardNav = lazy(() => import("./DashboardNav.jsx"));
const Login = lazy(() => import("./Login.jsx"));
const Signup = lazy(() => import("./Signup.jsx"));
const ForgotPassword = lazy(() => import("./ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./ResetPassword.jsx"));
const Jobs = lazy(() => import("./Jobs.jsx"));
const JobDetails = lazy(() => import("./JobDetails.jsx"));
const FreelancerDashboard = lazy(() => import("./FreelancerDashboard.jsx"));
const ClientDashboard = lazy(() => import("./ClientDashboard.jsx"));
const MyApplications = lazy(() => import("./MyApplications.jsx"));
const ApplyForm = lazy(() => import("./ApplyForm.jsx"));
const FreelancerProfile = lazy(() => import("./FreelancerProfile.jsx"));
const ClientProfile = lazy(() => import("./ClientProfile.jsx"));
const PostJob = lazy(() => import("./PostJob.jsx"));
const JobApplicants = lazy(() => import("./JobApplicants.jsx"));
const MyFreelancers = lazy(() => import("./MyFreelancers.jsx"));
const MyProjects = lazy(() => import("./MyProjects.jsx"));
const Messages = lazy(() => import("./Messages.jsx"));
const Notifications = lazy(() => import("./Notifications.jsx"));
const Reviews = lazy(() => import("./Reviews.jsx"));
const Portfolio = lazy(() => import("./Portfolio.jsx"));
const PublicProfile = lazy(() => import("./PublicProfile.jsx"));
const SocialPage = lazy(() => import("./SocialFeed.jsx").then((module) => ({ default: module.SocialPage })));
const Connections = lazy(() => import("./Connections.jsx"));
const AccountSettings = lazy(() => import("./AccountSettings.jsx"));
const DemoMode = lazy(() => import("./DemoMode.jsx"));
const AdminDashboard = lazy(() => import("./AdminDashboard.jsx"));
const SupportCenter = lazy(() => import("./SupportCenter.jsx"));
const FinancialSandbox = lazy(() => import("./FinancialSandbox.jsx"));


function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, loading } = useAuth();
  const dashboardPath = user?.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard";

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

      {user ? <DashboardNav user={user} /> : <header className="navbar">

        <Link to="/" className="logo">
          Tech<span>Karvo</span>
        </Link>

        <nav aria-label="Main navigation" className={"nav-links " + (menuOpen ? "active" : "")}>

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

        </nav>

        <div className="nav-buttons">

          {!loading && user ? <Link to={dashboardPath} className="signup-btn">Dashboard</Link> : <>
            <Link to="/demo" className="secondary-btn">Try Demo</Link>
            <Link to="/login" className="login-btn">Log In</Link>
            <Link to="/signup" className="signup-btn">Get Started</Link>
          </>}

        </div>

        <button
          className="menu-btn"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>

      </header>}


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
              and build your career beyond borders with TechKarvo.
            </p>

            <div className="hero-buttons">

              <Link to="/jobs" className="primary-btn">
                Explore Jobs →
              </Link>

          {!user && <Link to="/signup" className="secondary-btn">
                Become a Freelancer
          </Link>}
          <Link to="/demo" className="secondary-btn demo-hero-link">Try the interactive demo</Link>

            </div>

            <div className="trust">
              <span>✓</span>
              One platform for global freelance opportunities.
            </div>

          </div>


          {/* PREVIEW CARD */}

          <div className="wallet-card home-preview-card">

            <div className="card-top">
              <span>TechKarvo OVERVIEW</span>
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
              <span>TechKarvo</span>
            </div>

          </div>

        </section>


        {/* FEATURES */}

        <section id="features" className="features home-features">

          <div className="home-section-heading">

            <span>WHY TechKarvo</span>

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
            Start building your future with TechKarvo.
          </p>

        {!user && <Link to="/signup" className="primary-btn">
            Create Your Account →
          </Link>}

        </section>

      </main>


      {/* FOOTER */}

      <footer className="home-footer">

        <Link to="/" className="logo">
          Tech<span>Karvo</span>
        </Link>

        <p>
          © 2026 TechKarvo. All rights reserved.
        </p>

        <span>
          Connecting Talent Across Borders.
        </span>

      </footer>

    </div>
  );
}

function NotFound() {
  return (
    <main className="not-found-page">
      <span>404 · PAGE NOT FOUND</span>
      <h1>That page isn’t here.</h1>
      <p>The link may be outdated, or the address may be incorrect.</p>
      <div>
        <Link to="/" className="primary-btn">Go to TechKarvo</Link>
        <Link to="/jobs" className="secondary-btn">Browse jobs</Link>
      </div>
    </main>
  );
}


function App() {
  const location = useLocation();
  if (location.pathname === "/demo") {
    return <Suspense fallback={<main className="route-loading" aria-live="polite">Loading demo…</main>}><DemoMode /></Suspense>;
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="configuration-error" role="alert">
        <span className="configuration-error-brand">TechKarvo</span>
        <h1>We’ll be back shortly.</h1>
        <p>The marketplace is temporarily unavailable. Please try again later.</p>
      </main>
    );
  }

  return (
    <AuthProvider>
      <Suspense fallback={<main className="route-loading" aria-live="polite">Loading TechKarvo…</main>}>
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

      <Route path="/freelancer-dashboard" element={<RequireAuth roles={["Freelancer"]}><FreelancerDashboard /></RequireAuth>} />

      <Route path="/client-dashboard" element={<RequireAuth roles={["Client"]}><ClientDashboard /></RequireAuth>} />
      <Route path="/client-profile" element={<RequireAuth roles={["Client"]}><ClientProfile /></RequireAuth>} />

      <Route path="/my-applications" element={<RequireAuth roles={["Freelancer"]}><MyApplications /></RequireAuth>} />

      <Route path="/apply/:id" element={<RequireAuth roles={["Freelancer"]}><ApplyForm /></RequireAuth>} />
<Route
        path="/freelancer-profile"
        element={<RequireAuth roles={["Freelancer"]}><FreelancerProfile /></RequireAuth>}
      />

      <Route path="/post-job" element={<RequireAuth roles={["Client"]}><PostJob /></RequireAuth>} />

      <Route
        path="/job-applicants"
        element={<RequireAuth roles={["Client"]}><JobApplicants /></RequireAuth>}
      />

      <Route
        path="/my-freelancers"
        element={<RequireAuth roles={["Client"]}><MyFreelancers /></RequireAuth>}
      />

      <Route
        path="/my-projects"
        element={<RequireAuth roles={["Client"]}><MyProjects /></RequireAuth>}
      />

      <Route path="/messages" element={<RequireAuth roles={["Client", "Freelancer"]}><Messages /></RequireAuth>} />
      <Route path="/social" element={<RequireAuth roles={["Client", "Freelancer"]}><SocialPage /></RequireAuth>} />
      <Route path="/connections" element={<RequireAuth roles={["Client", "Freelancer"]}><Connections /></RequireAuth>} />
      <Route path="/account-settings" element={<RequireAuth roles={["Client", "Freelancer"]}><AccountSettings /></RequireAuth>} />
      <Route path="/support" element={<RequireAuth roles={["Client", "Freelancer"]}><SupportCenter /></RequireAuth>} />
      <Route path="/financial-sandbox" element={<RequireAuth roles={["Client", "Freelancer"]}><FinancialSandbox /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={["Client", "Freelancer"]}><AdminDashboard /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth roles={["Client", "Freelancer"]}><Notifications /></RequireAuth>} />
      <Route path="/reviews" element={<RequireAuth roles={["Client", "Freelancer"]}><Reviews /></RequireAuth>} />
      <Route path="/portfolio" element={<RequireAuth roles={["Freelancer"]}><Portfolio /></RequireAuth>} />
      <Route path="/profiles/:id" element={<RequireAuth roles={["Client", "Freelancer"]}><PublicProfile /></RequireAuth>} />
      <Route path="*" element={<NotFound />} />

        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
