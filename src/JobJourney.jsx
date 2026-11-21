import { Link, NavLink, useLocation } from "react-router-dom";
import DashboardNav from "./DashboardNav.jsx";
import { jobJourneyPath } from "./job-discovery.js";
import "./JobJourney.css";

export function JobJourney({ user, children }) {
  return <div className="job-journey">
    <a className="journey-skip" href="#journey-main">Skip to content</a>
    {user ? <DashboardNav user={user} /> : <header className="journey-public-header">
      <nav className="journey-width" aria-label="Main navigation">
        <Link className="journey-brand" to="/">Tech<span>Karvo</span></Link>
        <NavLink to="/jobs">Find Jobs</NavLink>
        <div className="journey-public-account"><Link to="/login">Log In</Link><Link to="/signup" className="journey-button">Sign Up</Link></div>
      </nav>
    </header>}
    <main id="journey-main" className="journey-width journey-main" tabIndex={-1}>{children}</main>
  </div>;
}

export function JobBackLink({ path = "/jobs", children = "Back to Jobs" }) {
  const { search } = useLocation();
  return <Link className="journey-back" to={jobJourneyPath(path, search)}><span aria-hidden="true">← </span>{children}</Link>;
}

export function JobState({ title, children, status, onRetry }) {
  return <section className="journey-panel journey-state" role={status === "error" ? "alert" : status === "loading" ? "status" : undefined}>
    <h2>{title}</h2>
    {children && <p>{children}</p>}
    {onRetry && <button className="journey-button journey-secondary" type="button" onClick={onRetry}>Try again</button>}
  </section>;
}

export function JobSkills({ skills, limit }) {
  const visible = skills.slice(0, limit ?? skills.length);
  return skills.length > 0 && <ul className="journey-tags" aria-label="Required skills">
    {visible.map((skill) => <li key={skill}>{skill}</li>)}
    {visible.length < skills.length && <li>+{skills.length - visible.length} more</li>}
  </ul>;
}
