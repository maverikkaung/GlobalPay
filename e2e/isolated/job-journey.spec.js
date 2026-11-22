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
    if (table === "membership_entitlements") return route.fulfill({ json: [{ plan_id: "fixture-plan", period_credit_limit: 5, credits_used: 1,
      period_started_at: new Date(Date.now() - 3600000).toISOString(), period_ends_at: new Date(Date.now() + 3600000).toISOString() }] });
    if (table === "membership_plans") return route.fulfill({ json: [{ id: "fixture-plan", is_active: true, is_simulation_only: true,
      account_type: "freelancer", included_usage_credits: 5 }] });
    if (table === "job_applications" && method === "POST") {
      return options.onApply ? options.onApply(route, request.postDataJSON()) : route.fulfill({ status: 201 });
    }
    if (table === "job_applications" && (typeof options.existing === "function" ? options.existing() : options.existing)) {
      return route.fulfill({ json: [{ id: "prior-application" }] });
    }
    return route.fulfill({ json: [] });
  });
  return requests;
}

test("job filters survive Back, Forward, detail navigation and refresh", async ({ page, baseURL }) => {
  await mockMarketplace(page, baseURL);
  await page.goto("/jobs");
  await page.getByRole("searchbox", { name: "Search open jobs" }).fill("React");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\?q=React$/);
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

test("a visitor who signs in as a freelancer returns to the intended proposal with its search", async ({ page, baseURL }) => {
  await mockMarketplace(page, baseURL);
  await page.goto(`/jobs/${jobId}?q=React&sort=title`);
  await page.getByRole("button", { name: "Apply for This Job" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email Address").fill("qa@example.invalid");
  await page.locator("#login-password").fill("fixture-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(`/apply/${jobId}?q=React&sort=title`);
  await expect(page.getByRole("heading", { name: "Apply for " + job.title })).toBeVisible();
  await expect(page.getByText("4 applications remaining")).toBeVisible();
  await page.getByRole("link", { name: "Back to Job Details" }).click();
  await expect(page).toHaveURL(`/jobs/${jobId}?q=React&sort=title`);
});

test("a client following a direct proposal URL is refused before any application request", async ({ page, baseURL }) => {
  const requests = await mockMarketplace(page, baseURL, { role: "client" });
  await page.goto(`/apply/${jobId}`);
  await expect(page).toHaveURL(/\/client-dashboard$/);
  await expect(page.getByRole("button", { name: "Submit Application" })).toHaveCount(0);
  expect(requests.filter((item) => item.path === "/rest/v1/job_applications" && item.method === "POST")).toEqual([]);
});

test("proposal validation, repeated submits and network retry preserve the draft", async ({ page, baseURL }) => {
  const attempts = [];
  await mockMarketplace(page, baseURL, { role: "freelancer", onApply: async (route, payload) => {
    attempts.push(payload);
    if (attempts.length === 1) return route.fulfill({ status: 503, json: { message: "Fixture disconnected" } });
    return route.fulfill({ status: 201 });
  } });
  await page.goto(`/apply/${jobId}`);
  const send = page.getByRole("button", { name: "Submit Application" });
  await expect(page.getByText("4 applications remaining")).toBeVisible();
  await send.click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Cover Letter")).toHaveAttribute("aria-invalid", "true");
  expect(attempts).toHaveLength(0);
  await page.getByLabel("Cover Letter").fill("I can preserve the draft while the network recovers.");
  await page.getByLabel("Expected Salary (USD)").fill("240.50");
  await page.locator("form.journey-proposal-form").evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole("alert")).toContainText("We couldn’t confirm submission");
  expect(attempts).toHaveLength(1);
  await expect(page.getByLabel("Cover Letter")).toHaveValue("I can preserve the draft while the network recovers.");
  await expect(page.getByLabel("Expected Salary (USD)")).toHaveValue("240.50");
  await send.click();
  await expect(page.getByText("Application submitted.")).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toMatchObject({ job_id: jobId, freelancer_id: freelancer, client_id: client,
    expected_salary: 240.5, status: "Pending" });
  await expect(page.getByRole("link", { name: "View your applications" })).toBeVisible();
});

test("an existing application is shown without a duplicate POST", async ({ page, baseURL }) => {
  const requests = await mockMarketplace(page, baseURL, { role: "freelancer", existing: true });
  await page.goto(`/apply/${jobId}`);
  await expect(page.getByRole("alert")).toContainText("You've already applied for this job");
  await expect(page.getByRole("button", { name: "Submit Application" })).toBeDisabled();
  expect(requests.filter((item) => item.path === "/rest/v1/job_applications" && item.method === "POST")).toEqual([]);
});

test("a lost response after the server saves a proposal is recovered by checking the existing application", async ({ page, baseURL }) => {
  let saved = false;
  const requests = await mockMarketplace(page, baseURL, {
    role: "freelancer", existing: () => saved, onApply: (route) => {
      saved = true;
      return route.fulfill({ status: 503, json: { message: "Fixture response lost" } });
    }
  });
  await page.goto(`/apply/${jobId}`);
  await expect(page.getByLabel("Professional Title")).toHaveValue("Frontend Developer");
  await page.getByLabel("Cover Letter").fill("A proposal saved before the response was lost.");
  await page.getByLabel("Expected Salary (USD)").fill("240");
  const submit = page.getByRole("button", { name: "Submit Application" });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("You've already applied for this job");
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("link", { name: "View your applications" })).toBeVisible();
  expect(requests.filter((item) => item.path === "/rest/v1/job_applications" && item.method === "POST")).toHaveLength(1);
});

test("the server quota response is actionable and leaves the proposal intact", async ({ page, baseURL }) => {
  await mockMarketplace(page, baseURL, { role: "freelancer", onApply: (route) => route.fulfill({ status: 400,
    json: { code: "23514", message: "No usage credits remain in this simulated membership cycle" } }) });
  await page.goto(`/apply/${jobId}`);
  await expect(page.getByLabel("Professional Title")).toHaveValue("Frontend Developer");
  await page.getByLabel("Cover Letter").fill("A proposal with a concurrent quota change.");
  await page.getByLabel("Expected Salary (USD)").fill("240");
  await page.getByRole("button", { name: "Submit Application" }).click();
  await expect(page.getByRole("alert")).toContainText("Your monthly application limit has been reached");
  await expect(page.getByLabel("Cover Letter")).toHaveValue("A proposal with a concurrent quota change.");
});

test("proposal and discovery fit supported widths in both themes and expose keyboard focus", async ({ page, baseURL }) => {
  await mockMarketplace(page, baseURL, { role: "freelancer" });
  for (const [path, heading] of [["/jobs", "Find your next project"], [`/jobs/${jobId}`, job.title], [`/apply/${jobId}`, "Apply for " + job.title]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((mode) => { document.documentElement.dataset.theme = mode; }, theme);
      await expect(page.locator(".job-journey")).toHaveCSS("background-color", theme === "light" ? "rgb(245, 247, 251)" : "rgb(11, 20, 36)");
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 860 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    }
  }
  const cover = page.getByLabel("Cover Letter");
  await cover.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Expected Salary (USD)")).toBeFocused();
});
