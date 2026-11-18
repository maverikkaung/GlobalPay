export const DEMO_STORAGE_KEY = "techkarvo-demo-v1";

export function createDemoState() {
  return {
    role: "freelancer",
    jobs: [
      { id: "demo-job-1", clientId: "demo-client", title: "Build a responsive booking dashboard", description: "Create a polished dashboard for a growing travel startup. The work includes accessible tables, filtering, and responsive charts.", budget: 1200, skills: ["React", "TypeScript", "Accessibility"], status: "open", createdAt: "2026-11-17T10:00:00.000Z" },
      { id: "demo-job-2", clientId: "demo-client", title: "Design a brand identity for a climate app", description: "Develop a clear visual system and handoff-ready assets for a mobile product.", budget: 850, skills: ["Figma", "Branding", "Mobile Design"], status: "in_progress", createdAt: "2026-11-15T09:00:00.000Z" },
      { id: "demo-job-3", clientId: "demo-client", title: "Improve product onboarding flow", description: "Review the first-run experience and deliver implementation-ready screens.", budget: 600, skills: ["UX Research", "Product Design"], status: "open", createdAt: "2026-11-14T08:00:00.000Z" }
    ],
    applications: [
      { id: "demo-app-1", jobId: "demo-job-1", freelancerId: "demo-freelancer", proposal: "I build accessible React dashboards and can deliver the core flow in two weeks.", budget: 1100, status: "Pending" },
      { id: "demo-app-2", jobId: "demo-job-2", freelancerId: "demo-freelancer", proposal: "I have completed a similar brand system for a sustainability product.", budget: 800, status: "Accepted" }
    ],
    posts: [
      { id: "demo-post-1", authorId: "demo-freelancer", body: "Just wrapped a focused accessibility review: keyboard support and clear error messages made the biggest difference.", kind: "insight", createdAt: "2026-11-18T09:00:00.000Z", likes: ["demo-client"], comments: [{ id: "demo-comment-1", authorId: "demo-client", body: "Great reminder. How do you prioritize fixes?" }] },
      { id: "demo-post-2", authorId: "demo-client", body: "We are planning the next release of our travel platform and would love to meet product designers who care about simple, inclusive experiences.", kind: "update", createdAt: "2026-11-17T15:30:00.000Z", likes: [], comments: [] }
    ],
    messages: [
      { id: "demo-message-1", senderId: "demo-client", body: "Hi Maya, your dashboard experience looks like a strong fit. Are you available next week?", createdAt: "2026-11-18T08:30:00.000Z" },
      { id: "demo-message-2", senderId: "demo-freelancer", body: "Thanks! I am available Monday and can share a short implementation plan before we start.", createdAt: "2026-11-18T08:45:00.000Z" }
    ],
    reviews: []
  };
}

export function readDemoState(storage) {
  try {
    storage ||= globalThis.localStorage;
    const saved = storage?.getItem(DEMO_STORAGE_KEY);
    if (!saved) return createDemoState();
    const parsed = JSON.parse(saved);
    const seed = createDemoState();
    if (!parsed || !["client", "freelancer"].includes(parsed.role)) return seed;
    return {
      ...seed, ...parsed,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : seed.jobs,
      applications: Array.isArray(parsed.applications) ? parsed.applications : seed.applications,
      posts: Array.isArray(parsed.posts) ? parsed.posts : seed.posts,
      messages: Array.isArray(parsed.messages) ? parsed.messages : seed.messages,
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : seed.reviews
    };
  } catch { return createDemoState(); }
}

export function writeDemoState(state, storage) {
  try { storage ||= globalThis.localStorage; storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function resetDemoState(storage) {
  try { storage ||= globalThis.localStorage; storage?.removeItem(DEMO_STORAGE_KEY); } catch { /* The in-memory demo remains usable. */ }
  return createDemoState();
}
