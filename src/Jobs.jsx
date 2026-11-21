import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getJobCategories } from "./marketplace.js";
import { JOB_FIELDS, filterJobs, formatJobBudget, jobJourneyPath, presentJob, readJobFilters, writeJobFilters } from "./job-discovery.js";
import { JobJourney, JobSkills, JobState } from "./JobJourney.jsx";

function JobSearch({ query, onSearch }) {
  const input = useRef(null);
  useEffect(() => { input.current.value = query; }, [query]);
  return <form className="journey-search" role="search" onSubmit={(event) => {
    event.preventDefault();
    onSearch(new FormData(event.currentTarget).get("query"));
  }}>
    <label htmlFor="jobs-search-input">Search open jobs</label>
    <div>
      <input ref={input} id="jobs-search-input" name="query" type="search"
        defaultValue={query} maxLength={120} placeholder="Try React, design or writing" />
      <button className="journey-button" type="submit">Search</button>
    </div>
  </form>;
}

function BudgetFilters({ filters, onApply }) {
  return <form className="journey-budget-form" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onApply({ minBudget: data.get("min"), maxBudget: data.get("max") });
  }}>
    <label htmlFor="jobs-min-budget">Minimum budget</label>
    <input id="jobs-min-budget" name="min" type="number" min="0" max="999999999999.99" step="0.01" defaultValue={filters.minBudget} />
    <label htmlFor="jobs-max-budget">Maximum budget</label>
    <input id="jobs-max-budget" name="max" type="number" min="0" max="999999999999.99" step="0.01" defaultValue={filters.maxBudget} />
    <button className="journey-button journey-secondary" type="submit">Apply budget</button>
  </form>;
}

function JobCard({ job, search, user }) {
  return <article className="job-card journey-job-card">
    <div className="journey-card-meta">
      <span>{job.category || "Other"}</span>
      {job.isFeatured && <span className="journey-featured">Featured</span>}
    </div>
    <div className="journey-card-heading">
      <h3><Link to={jobJourneyPath("/jobs/" + job.id, search)}>{job.title}</Link></h3>
      <p className="journey-budget">{formatJobBudget(job)}</p>
    </div>
    <p className="journey-muted">
      {job.company && user
        ? <Link to={"/profiles/" + job.clientId}>{job.company}</Link>
        : <span>TechKarvo client</span>}
      {job.paymentType && <span> · {job.paymentType}</span>}
    </p>
    <p className="journey-job-description">{job.description}</p>
    <JobSkills skills={job.skills} limit={5} />
    <div className="journey-actions">
      <Link className="journey-button journey-secondary" to={jobJourneyPath("/jobs/" + job.id, search)}>View Details</Link>
      {(!user || user.accountType === "Freelancer") && <Link className="journey-button" to={jobJourneyPath("/apply/" + job.id, search)}>Apply Now</Link>}
    </div>
  </article>;
}

export default function Jobs() {
  const { user } = useAuth();
  const userId = user?.id;
  const canCheckAdvanced = user?.accountType === "Freelancer";
  const [params, setParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [access, setAccess] = useState(null);
  const [result, setResult] = useState(null);
  const requestKey = (userId || "public") + ":" + attempt;

  useEffect(() => {
    if (!canCheckAdvanced) return;
    let active = true;
    supabase.rpc("techkarvo_has_membership_feature", { p_feature: "advanced_search" }).then(({ data, error }) => {
      if (active) setAccess({ userId, allowed: !error && data === true });
    }, () => {
      if (active) setAccess({ userId, allowed: false });
    });
    return () => { active = false; };
  }, [canCheckAdvanced, userId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data, error } = await supabase.from("jobs").select(JOB_FIELDS)
          .eq("status", "open").order("created_at", { ascending: false });
        if (!active) return;
        if (error) throw error;
        const rows = data || [];
        const clientIds = [...new Set(rows.map((job) => job.client_id).filter(Boolean))];
        const featuredIds = rows.filter((job) => job.is_featured).map((job) => job.id);
        const optional = (request) => request.then(({ data, error }) => error ? [] : data || [], () => []);
        const [clients, featured] = await Promise.all([
          userId && clientIds.length
            ? optional(supabase.from("client_public_profiles").select("id,full_name").in("id", clientIds))
            : [],
          featuredIds.length ? optional(supabase.rpc("techkarvo_current_featured_job_ids", { p_job_ids: featuredIds })) : []
        ]);
        const names = new Map(clients.map((client) => [client.id, client.full_name]));
        const featuredSet = new Set(featured.map(({ id }) => id));
        if (active) setResult({
          key: requestKey,
          jobs: rows.map((row) => ({ ...presentJob(row, names.get(row.client_id)), isFeatured: featuredSet.has(row.id) }))
        });
      } catch {
        if (active) setResult({ key: requestKey, error: true });
      }
    }

    load();
    return () => { active = false; };
  }, [requestKey, userId]);

  const current = result?.key === requestKey ? result : null;
  const jobs = current?.jobs || [];
  const categories = getJobCategories(jobs);
  const filters = readJobFilters(params, current?.jobs ? categories : undefined);
  const canUseAdvanced = canCheckAdvanced && access?.userId === userId && access?.allowed;
  const advanced = canUseAdvanced && filters.advanced;
  const hasFilters = Boolean(filters.query || filters.category || (advanced && (filters.minBudget || filters.maxBudget)));
  const visible = filterJobs(jobs, filters, canUseAdvanced);
  const invalidBudgetRange = advanced && filters.minBudget && filters.maxBudget && Number(filters.minBudget) > Number(filters.maxBudget);
  const search = writeJobFilters(filters).toString();
  function changeFilters(changes) {
    setParams(writeJobFilters(readJobFilters(writeJobFilters({ ...filters, ...changes }), current?.jobs ? categories : undefined)));
  }

  return <JobJourney user={user}>
    <header className="journey-intro">
      <div><h1>Find your next project</h1><p>Explore open jobs by skill, title or client.</p></div>
      <JobSearch query={filters.query} onSearch={(query) => changeFilters({ query })} />
    </header>
    <div className="journey-browse">
      <aside className="journey-panel journey-filters" aria-labelledby="jobs-filter-heading">
        <h2 id="jobs-filter-heading">Filters</h2>
        <label htmlFor="jobs-category">Category</label>
        <select id="jobs-category" value={filters.category || "All"} onChange={(event) => changeFilters({ category: event.target.value })}>
          {filters.category && !categories.includes(filters.category) && <option>{filters.category}</option>}
          {categories.map((category) => <option key={category}>{category}</option>)}
        </select>
        {canUseAdvanced && <button type="button" className="journey-button journey-secondary"
          aria-expanded={Boolean(advanced)} onClick={() => changeFilters({ advanced: !advanced })}>
          {advanced ? "Hide advanced filters" : "Advanced search"}
        </button>}
        {advanced && <BudgetFilters key={filters.minBudget + ":" + filters.maxBudget} filters={filters} onApply={changeFilters} />}
        {invalidBudgetRange && <p role="alert" className="journey-error">Minimum budget must be less than or equal to the maximum.</p>}
        {hasFilters && <button type="button" className="journey-clear" onClick={() => changeFilters({
          query: "", category: "", minBudget: "", maxBudget: ""
        })}>Clear filters</button>}
      </aside>

      <section className="journey-results" aria-labelledby="jobs-results-heading" aria-busy={!current}>
        <div className="journey-results-header">
          <div><h2 id="jobs-results-heading">Open jobs</h2>
            {current?.jobs && <p role="status" className="journey-muted">{visible.length} {visible.length === 1 ? "job" : "jobs"} found</p>}
          </div>
          <div className="journey-sort">
            <label htmlFor="jobs-sort">Sort by</label>
            <select id="jobs-sort" value={filters.sort} onChange={(event) => changeFilters({ sort: event.target.value })}>
              <option value="newest">Most recent</option>
              <option value="title">Title A to Z</option>
            </select>
          </div>
        </div>
        {!current ? <JobState title="Loading opportunities" status="loading">Fetching open jobs…</JobState>
          : current.error ? <JobState title="Jobs unavailable" status="error" onRetry={() => setAttempt((value) => value + 1)}>
            We couldn’t load jobs right now.
          </JobState>
          : visible.length > 0 ? <div className="journey-job-list">{visible.map((job) => <JobCard key={job.id} job={job} search={search} user={user} />)}</div>
          : jobs.length ? <JobState title="No matching jobs">Try another keyword or change your filters.</JobState>
          : <JobState title="No open jobs yet">New opportunities will appear here when clients publish them.</JobState>}
      </section>
    </div>
  </JobJourney>;
}
