import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "./useTheme.js";
import { readDemoState, resetDemoState, writeDemoState } from "./demo-state.js";

const people = {
  client: { id: "demo-client", name: "Aye Thandar", title: "Product Lead · Wayfarer", location: "Yangon, Myanmar", initials: "AT", bio: "Building thoughtful travel tools for people who want to explore more." },
  freelancer: { id: "demo-freelancer", name: "Maya Lin", title: "Product Designer & React Developer", location: "Chiang Mai, Thailand", initials: "ML", bio: "I turn complex product ideas into accessible, calm, useful experiences." }
};

function DemoMode() {
  const [data, setData] = useState(readDemoState);
  const [section, setSection] = useState("overview");
  const [notice, setNotice] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobBudget, setJobBudget] = useState("");
  const [postDraft, setPostDraft] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [messageDraft, setMessageDraft] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");
  const { theme, toggleTheme } = useTheme();
  const isClient = data.role === "client";
  const activePerson = people[data.role];
  const otherPerson = people[isClient ? "freelancer" : "client"];
  const activeJobs = useMemo(() => data.jobs.filter((job) => isClient || job.clientId !== activePerson.id), [activePerson.id, data.jobs, isClient]);
  const activeConversations = data.messages;

  useEffect(() => {
    writeDemoState(data);
  }, [data]);

  function update(transform) { setData((current) => transform(current)); }
  function switchRole(role) {
    setData((current) => ({ ...current, role }));
    setSection("overview"); setNotice(`You are now viewing TechKarvo as a ${role}.`);
  }
  function reset() {
    setData(resetDemoState()); setSection("overview"); setNotice("Demo restored to its original sample data.");
  }
  function createJob(event) {
    event.preventDefault();
    if (!jobTitle.trim() || !jobDescription.trim() || !Number(jobBudget)) return;
    const job = { id: `demo-job-${Date.now()}`, clientId: people.client.id, title: jobTitle.trim(), description: jobDescription.trim(), budget: Number(jobBudget), skills: ["New project"], status: "open", createdAt: new Date().toISOString() };
    update((current) => ({ ...current, jobs: [job, ...current.jobs] }));
    setJobTitle(""); setJobDescription(""); setJobBudget(""); setNotice("Your sample job is posted in this demo."); setSection("jobs");
  }
  function apply(job) {
    if (data.applications.some((item) => item.jobId === job.id && item.freelancerId === people.freelancer.id)) { setNotice("You have already applied to this sample job."); return; }
    update((current) => ({ ...current, applications: [...current.applications, { id: `demo-app-${Date.now()}`, jobId: job.id, freelancerId: people.freelancer.id, proposal: "I would love to help with this project. My experience matches the skills you listed.", budget: job.budget, status: "Pending" }] }));
    setNotice("Application submitted. Switch to Client to review it.");
  }
  function decideApplication(applicationId, status) {
    update((current) => {
      const applications = current.applications.map((application) => application.id === applicationId ? { ...application, status } : application);
      if (status !== "Accepted") return { ...current, applications };
      const app = applications.find((application) => application.id === applicationId);
      const job = current.jobs.find((item) => item.id === app.jobId);
      const jobs = current.jobs.map((item) => item.id === job.id ? { ...item, status: "in_progress" } : item);
      return { ...current, applications, jobs };
    });
    setNotice(status === "Accepted" ? "Freelancer hired. The sample project is now active." : "Application declined in the demo.");
  }
  function publishPost(event) {
    event.preventDefault();
    if (!postDraft.trim()) return;
    const post = { id: `demo-post-${Date.now()}`, authorId: activePerson.id, body: postDraft.trim(), kind: "update", createdAt: new Date().toISOString(), likes: [], comments: [] };
    update((current) => ({ ...current, posts: [post, ...current.posts] })); setPostDraft(""); setNotice("Your professional update is published in the demo.");
  }
  function toggleLike(postId) {
    update((current) => ({ ...current, posts: current.posts.map((post) => post.id !== postId ? post : { ...post, likes: post.likes.includes(activePerson.id) ? post.likes.filter((id) => id !== activePerson.id) : [...post.likes, activePerson.id] }) }));
  }
  function addComment(event, postId) {
    event.preventDefault(); const body = (commentDrafts[postId] || "").trim(); if (!body) return;
    update((current) => ({ ...current, posts: current.posts.map((post) => post.id === postId ? { ...post, comments: [...post.comments, { id: `demo-comment-${Date.now()}`, authorId: activePerson.id, body }] } : post) }));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
  }
  function sendMessage(event) {
    event.preventDefault(); if (!messageDraft.trim()) return;
    update((current) => ({ ...current, messages: [...current.messages, { id: `demo-message-${Date.now()}`, senderId: activePerson.id, body: messageDraft.trim(), createdAt: new Date().toISOString() }] }));
    setMessageDraft("");
  }
  function completeProject(jobId) {
    update((current) => ({ ...current, jobs: current.jobs.map((job) => job.id === jobId ? { ...job, status: "completed" } : job) }));
    setNotice("Project marked complete. Add a sample review below.");
  }
  function submitReview(event, jobId) {
    event.preventDefault(); if (!reviewDraft.trim()) return;
    update((current) => ({ ...current, reviews: [...current.reviews, { id: `demo-review-${Date.now()}`, jobId, reviewerId: activePerson.id, body: reviewDraft.trim(), rating: 5 }] }));
    setReviewDraft(""); setNotice("Your five-star sample review is saved in the demo only.");
  }

  const applicants = data.applications.filter((application) => data.jobs.some((job) => job.id === application.jobId && job.clientId === people.client.id));
  const myApplications = data.applications.filter((application) => application.freelancerId === people.freelancer.id);

  return <main className="demo-shell">
    <header className="demo-header">
      <Link to="/" className="demo-logo" aria-label="TechKarvo home">Tech<span>Karvo</span></Link>
      <p className="demo-label">INTERACTIVE DEMO <span>• Sample data only</span></p>
      <div className="demo-header-actions">
        <button type="button" className="demo-theme-button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>{theme === "dark" ? "Light theme" : "Dark theme"}</button>
        <button type="button" className="demo-reset-button" onClick={reset}>Reset Demo</button>
        <Link to="/" className="demo-exit-button">Exit Demo</Link>
      </div>
    </header>
    <div className="demo-layout">
      <aside className="demo-sidebar" aria-label="Demo navigation">
        <div className="demo-role-switch" role="group" aria-label="Switch demo role">
          <button type="button" aria-pressed={isClient} className={isClient ? "active" : ""} onClick={() => switchRole("client")}>Demo as Client</button>
          <button type="button" aria-pressed={!isClient} className={!isClient ? "active" : ""} onClick={() => switchRole("freelancer")}>Demo as Freelancer</button>
        </div>
        <div className="demo-member"><span className="demo-avatar">{activePerson.initials}</span><div><strong>{activePerson.name}</strong><span>{activePerson.title}</span></div></div>
        <nav className="demo-nav" aria-label="Demo sections">
          {[ ["overview", "Overview"], ["jobs", isClient ? "My Jobs & Applicants" : "Job Feed & Applications"], ["feed", "Daily Feed"], ["messages", "Messages"], ["contracts", "Contracts & Reviews"] ].map(([id, label]) => <button key={id} type="button" className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>)}
        </nav>
        <p className="demo-isolation-note">This is a local-only demo. Your actions never reach Supabase.</p>
      </aside>

      <section className="demo-content" aria-live="polite">
        {notice && <p className="demo-notice" role="status">{notice}</p>}
        <header className="demo-page-heading"><div><span className="demo-eyebrow">{isClient ? "CLIENT WORKSPACE" : "FREELANCER WORKSPACE"}</span><h1>{section === "overview" ? `Welcome, ${activePerson.name.split(" ")[0]}` : section === "jobs" ? (isClient ? "Your projects & applicants" : "Find your next project") : section === "feed" ? "Daily Feed" : section === "messages" ? "Messages" : "Contracts & reviews"}</h1><p>{section === "overview" ? "Explore a realistic marketplace with sample activity." : "A safe, interactive preview with no account required."}</p></div><div className="demo-location">{activePerson.location}</div></header>

        {section === "overview" && <div className="demo-overview-grid">
          <article className="demo-card demo-profile-card"><span className="demo-avatar demo-avatar-large">{activePerson.initials}</span><span className="demo-eyebrow">PUBLIC PROFILE PREVIEW</span><h2>{activePerson.name}</h2><strong>{activePerson.title}</strong><p>{activePerson.bio}</p><div className="demo-skills"><span>{isClient ? "Product Strategy" : "React"}</span><span>{isClient ? "Travel" : "Accessibility"}</span><span>{isClient ? "Remote team" : "UI/UX Design"}</span></div><button type="button" onClick={() => setSection("feed")}>See professional updates</button></article>
          <article className="demo-card demo-stat-card"><span>Open opportunities</span><strong>{data.jobs.filter((job) => job.status === "open").length}</strong><p>Explore current sample job offers.</p><button type="button" onClick={() => setSection("jobs")}>Browse jobs</button></article>
          <article className="demo-card demo-stat-card"><span>{isClient ? "Applications to review" : "Your applications"}</span><strong>{isClient ? applicants.filter((app) => app.status === "Pending").length : myApplications.length}</strong><p>Follow the hiring process from either side.</p><button type="button" onClick={() => setSection("jobs")}>{isClient ? "Review applicants" : "View applications"}</button></article>
          <article className="demo-card demo-stat-card"><span>Recent messages</span><strong>{activeConversations.length}</strong><p>Continue the sample project conversation.</p><button type="button" onClick={() => setSection("messages")}>Open messages</button></article>
          <article className="demo-card demo-stat-card"><span>Daily Feed</span><strong>{data.posts.length}</strong><p>Professional notes and community updates.</p><button type="button" onClick={() => setSection("feed")}>Open feed</button></article>
        </div>}

        {section === "jobs" && <div className="demo-stack">
          {isClient && <form className="demo-card demo-form" onSubmit={createJob}><h2>Post a sample job</h2><label htmlFor="demo-job-title">Job title</label><input id="demo-job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} required maxLength={120} placeholder="e.g. Design a customer portal" /><label htmlFor="demo-job-description">What needs to be done?</label><textarea id="demo-job-description" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} required maxLength={1000} rows={3} placeholder="Describe the project and skills…" /><label htmlFor="demo-job-budget">Budget (USD)</label><input id="demo-job-budget" type="number" min="1" value={jobBudget} onChange={(event) => setJobBudget(event.target.value)} required /><button className="demo-primary" type="submit">Publish sample job</button></form>}
          {activeJobs.map((job) => { const jobApps = data.applications.filter((app) => app.jobId === job.id); const myApp = jobApps.find((app) => app.freelancerId === people.freelancer.id); return <article className="demo-card demo-job-card" key={job.id}><div className="demo-card-heading"><div><span className="demo-eyebrow">{job.status.replaceAll("_", " ")}</span><h2>{job.title}</h2></div><strong>${job.budget.toLocaleString()}</strong></div><p>{job.description}</p><div className="demo-skills">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><p className="demo-client-line">Posted by {people.client.name} · {new Date(job.createdAt).toLocaleDateString()}</p>
            {!isClient && job.status === "open" && <button className="demo-primary" type="button" disabled={Boolean(myApp)} onClick={() => apply(job)}>{myApp ? `Applied · ${myApp.status}` : "Apply to this job"}</button>}
            {isClient && jobApps.length > 0 && <div className="demo-applicants"><h3>Applicants</h3>{jobApps.map((application) => <div className="demo-applicant-row" key={application.id}><span className="demo-avatar">ML</span><div><strong>{people.freelancer.name}</strong><span>${application.budget} · {application.status}</span><p>{application.proposal}</p></div>{application.status === "Pending" && <div className="demo-inline-actions"><button type="button" onClick={() => { setSection("messages"); setNotice("Message Maya about this application."); }}>Message</button><button type="button" className="demo-primary" onClick={() => decideApplication(application.id, "Accepted")}>Hire</button><button type="button" onClick={() => decideApplication(application.id, "Rejected")}>Decline</button></div>}</div>)}</div>}
          </article>; })}
          {activeJobs.length === 0 && <p className="demo-empty">No sample jobs yet. Switch roles or post a job to get started.</p>}
        </div>}

        {section === "feed" && <div className="demo-stack"><form className="demo-card demo-form" onSubmit={publishPost}><h2>Share a professional update</h2><label className="visually-hidden" htmlFor="demo-post-body">Write a post</label><textarea id="demo-post-body" value={postDraft} onChange={(event) => setPostDraft(event.target.value)} maxLength={1000} rows={3} placeholder="Share an insight, service, or project update…" /><button className="demo-primary" type="submit" disabled={!postDraft.trim()}>Publish update</button></form>{data.posts.map((post) => { const author = post.authorId === people.client.id ? people.client : people.freelancer; const liked = post.likes.includes(activePerson.id); return <article className="demo-card demo-post" key={post.id}><div className="demo-post-author"><span className="demo-avatar">{author.initials}</span><div><strong>{author.name}</strong><span>{author.title}</span></div><time>{new Date(post.createdAt).toLocaleDateString()}</time></div><p>{post.body}</p><div className="demo-post-actions"><button type="button" aria-pressed={liked} onClick={() => toggleLike(post.id)}>{liked ? "♥ Liked" : "♡ Like"} · {post.likes.length}</button><span>{post.comments.length} comments</span><button type="button" onClick={() => { setSection("messages"); setNotice(`You opened a conversation with ${author.name}.`); }}>Message author</button></div><div className="demo-comments">{post.comments.map((comment) => <p key={comment.id}><strong>{comment.authorId === people.client.id ? people.client.name : people.freelancer.name}:</strong> {comment.body}</p>)}<form onSubmit={(event) => addComment(event, post.id)}><label className="visually-hidden" htmlFor={`demo-comment-${post.id}`}>Write a comment</label><input id={`demo-comment-${post.id}`} value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={300} placeholder="Add a thoughtful comment" /><button type="submit" disabled={!(commentDrafts[post.id] || "").trim()}>Comment</button></form></div></article>; })}</div>}

        {section === "messages" && <div className="demo-card demo-messages"><div><span className="demo-eyebrow">SAMPLE CONVERSATION</span><h2>{otherPerson.name}</h2><p>{otherPerson.title} · project discussion</p></div><div className="demo-message-list" aria-label="Sample conversation">{data.messages.map((message) => <div className={`demo-message ${message.senderId === activePerson.id ? "mine" : "theirs"}`} key={message.id}><span>{message.senderId === people.client.id ? people.client.name : people.freelancer.name}</span><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {message.senderId === activePerson.id ? "Seen" : "Read"}</time></div>)}</div><form className="demo-message-form" onSubmit={sendMessage}><label className="visually-hidden" htmlFor="demo-message-draft">Write a message</label><input id="demo-message-draft" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={500} placeholder="Write a message…" /><button className="demo-primary" type="submit" disabled={!messageDraft.trim()}>Send</button></form><p className="demo-isolation-note">Messages here are sample content and are not sent to another person.</p></div>}

        {section === "contracts" && <div className="demo-stack">{data.jobs.filter((job) => job.status !== "open").map((job) => <article className="demo-card demo-contract" key={job.id}><span className="demo-eyebrow">{job.status === "completed" ? "COMPLETED" : "ACTIVE CONTRACT"}</span><h2>{job.title}</h2><p>{people.client.name} · {people.freelancer.name} · ${job.budget.toLocaleString()}</p><p>This is a sample hiring record. Accepting work does not reserve or transfer money.</p>{isClient && job.status === "in_progress" && <button className="demo-primary" type="button" onClick={() => completeProject(job.id)}>Mark project complete</button>}{job.status === "completed" && <form className="demo-review-form" onSubmit={(event) => submitReview(event, job.id)}><label htmlFor={`demo-review-${job.id}`}>Leave a 5-star sample review</label><input id={`demo-review-${job.id}`} value={reviewDraft} onChange={(event) => setReviewDraft(event.target.value)} maxLength={300} placeholder="Share feedback about working together" /><button className="demo-primary" type="submit" disabled={!reviewDraft.trim()}>Submit review</button></form>}{data.reviews.filter((review) => review.jobId === job.id).map((review) => <p className="demo-review" key={review.id}>★★★★★ · {review.reviewerId === people.client.id ? people.client.name : people.freelancer.name}: {review.body}</p>)}</article>)}{data.jobs.every((job) => job.status === "open") && <p className="demo-empty">A contract appears here after a client hires a freelancer.</p>}</div>}
      </section>
    </div>
  </main>;
}

export default DemoMode;
