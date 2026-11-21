import { test, expect } from "@playwright/test";

const backend = "https://e2e-placeholder.invalid";
const client = "20000000-0000-4000-8000-000000000001";
const freelancer = "20000000-0000-4000-8000-000000000002";
const jobId = "20000000-0000-4000-8000-000000000003";
const secondId = "20000000-0000-4000-8000-000000000004";
const job = { id: jobId, client_id: client, title: "Build a React site", description: "Build a site with keyboard navigation.",
  category: "Web Development", skills: "React, CSS", budget: 240, currency: "USD", payment_type: "Fixed Price",
  status: "open", created_at: "2026-11-20T12:00:00Z" };

async function mockMarketplace(page, baseURL, options = {}) {
  const origin = new URL(baseURL).origin;
  const requests = [];
  const profile = { id: options.role === "client" ? client : freelancer, full_name: "Fixture member", account_type: options.role || "freelancer",
    country: "Myanmar", professional_title: "Frontend Developer", bio: "I build accessible websites.", skills: "React, CSS", experience: "1-2 years" };
  const makeSession = () => ({ access_token: "fixture-session", refresh_token: "fixture-refresh", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user: { id: profile.id, email: "qa@example.invalid" } });
  if (options.role) await page.addInitScript(({ origin, session }) => {
    if (location.origin === origin) localStorage.setItem("sb-e2e-placeholder-auth-token", JSON.stringify(session));
  }, { origin, session: makeSession() });
  await page.routeWebSocket("wss://e2e-placeholder.invalid/**", (socket) => socket.close());
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== backend) return route.abort();
    const method = request.method();
    requests.push({ method, path: url.pathname });
    if (method === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "*/0" } });
    if (url.pathname === "/auth/v1/token") return route.fulfill({ json: makeSession() });
    if (url.pathname === "/rest/v1/rpc/techkarvo_has_membership_feature") return route.fulfill({ json: Boolean(options.advanced) });
    if (url.pathname.startsWith("/rest/v1/rpc/")) return route.fulfill({ json: false });
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "jobs") {
      const id = url.searchParams.get("id")?.slice(3);
      if (id && options.onDetail) return options.onDetail(route, id);
      const rows = options.jobs || [job, { ...job, id: secondId, title: "Audit React components", budget: 80 }];
      return route.fulfill({ json: id ? rows.filter((row) => row.id === id) : rows });
    }
    if (table === "profiles") return route.fulfill({ json: [profile] });
    if (table === "client_public_profiles") return route.fulfill({ json: [{ id: client, full_name: "Fixture Studio" }] });
    return route.fulfill({ json: [] });
  });
  return requests;
}

test("job filters survive Back, Forward, detail navigation and refresh", async ({ page, baseURL }) => {
  await mockMarketplace(page, baseURL);
  await page.goto("/jobs");
  await page.getByRole("searchbox", { name: "Search open jobs" }).fill("React");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Category").selectOption("Web Development");
  await page.getByLabel("Sort by").selectOption("title");
  await expect(page.locator(".job-card").first()).toContainText("Audit React components");
  await page.getByRole("link", { name: job.title }).click();
  await expect(page).toHaveURL(/\/jobs\/[^?]+\?q=React&category=Web\+Development&sort=title$/);
  await page.goBack();
  await expect(page.getByRole("searchbox")).toHaveValue("React");
  await page.goForward();
  await expect(page.getByRole("heading", { name: job.title })).toBeVisible();
  await page.reload();
  await page.getByRole("link", { name: "Back to Jobs" }).click();
  await expect(page.getByLabel("Category")).toHaveValue("Web Development");
  await expect(page.getByLabel("Sort by")).toHaveValue("title");
});

test("eligible freelancer budgets persist but the same URL cannot enable them for a client", async ({ browser, baseURL }) => {
  const search = "/jobs?advanced=1&minBudget=200";
  const worker = await browser.newPage({ baseURL });
  await mockMarketplace(worker, baseURL, { role: "freelancer", advanced: true });
  await worker.goto(search);
  await expect(worker.getByLabel("Minimum budget")).toHaveValue("200");
  await expect(worker.locator(".job-card")).toHaveCount(1);
  await worker.reload();
  await expect(worker.locator(".job-card")).toHaveCount(1);
  await worker.close();
  const hiring = await browser.newPage({ baseURL });
  await mockMarketplace(hiring, baseURL, { role: "client" });
  await hiring.goto(search);
  await expect(hiring.getByRole("button", { name: "Quick actions" })).toBeVisible();
  await expect(hiring.getByLabel("Minimum budget")).toHaveCount(0);
  await expect(hiring.locator(".job-card")).toHaveCount(2);
  await expect(hiring.getByRole("link", { name: "Apply Now" })).toHaveCount(0);
  await hiring.close();
});

test("job details distinguish a retryable response, a closed posting and a missing posting", async ({ page, baseURL }) => {
  let fail = true;
  await mockMarketplace(page, baseURL, { onDetail: (route, id) => {
    if (id === secondId) return route.fulfill({ json: [] });
    if (fail) return route.fulfill({ status: 503, json: { message: "Fixture unavailable" } });
    return route.fulfill({ json: [{ ...job, status: "completed" }] });
  } });
  await page.goto("/jobs/" + jobId);
  await expect(page.getByRole("alert")).toContainText("We couldn’t load this job");
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("This job is closed and no longer accepting applications.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply for This Job" })).toHaveCount(0);
  await page.goto("/jobs/" + secondId);
  await expect(page.getByRole("heading", { name: "Job unavailable" })).toBeVisible();
});
