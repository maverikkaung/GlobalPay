import { test, expect } from "@playwright/test";

test("owner dashboard route stays behind authentication for public visitors", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await page.goto("/support");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("visitor can complete a sample client-to-freelancer hiring journey without Supabase", async ({ page }) => {
  const supabaseRequests = [];
  const pageErrors = [];
  page.on("request", (request) => {
    if (/supabase\.(co|in)\//i.test(request.url())) supabaseRequests.push(request.url().split("/").slice(0, 3).join("/"));
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const newTitle = `E2E sample project ${Date.now()}`;

  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Welcome, Maya" })).toBeVisible();
  await expect(page.getByText("This is a local-only demo. Your actions never reach Supabase.")).toBeVisible();

  await page.getByRole("button", { name: "Demo as Client" }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Aye" })).toBeVisible();
  await page.getByRole("navigation", { name: "Demo sections" }).getByRole("button", { name: "My Jobs & Applicants" }).click();
  await page.getByLabel("Job title").fill(newTitle);
  await page.getByLabel("What needs to be done?").fill("A test-only project for verifying the demo hiring workflow.");
  await page.getByLabel("Budget (USD)").fill("420");
  await page.getByRole("button", { name: "Publish sample job" }).click();
  await expect(page.getByText(newTitle, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Demo as Freelancer" }).click();
  await page.getByRole("navigation", { name: "Demo sections" }).getByRole("button", { name: "Job Feed & Applications" }).click();
  const job = page.locator(".demo-job-card").filter({ hasText: newTitle });
  await job.getByRole("button", { name: "Apply to this job" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Application submitted" })).toBeVisible();

  await page.getByRole("button", { name: "Demo as Client" }).click();
  await page.getByRole("navigation", { name: "Demo sections" }).getByRole("button", { name: "My Jobs & Applicants" }).click();
  const clientJob = page.locator(".demo-job-card").filter({ hasText: newTitle });
  await expect(clientJob.getByText(/Pending/)).toBeVisible();
  await clientJob.getByRole("button", { name: "Hire" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Freelancer hired" })).toBeVisible();
  await page.getByRole("navigation", { name: "Demo sections" }).getByRole("button", { name: "Contracts & Reviews" }).click();
  const contract = page.locator(".demo-contract").filter({ hasText: newTitle });
  await contract.getByRole("button", { name: "Mark project complete" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Project marked complete" })).toBeVisible();
  await contract.getByLabel("Leave a 5-star sample review").fill("E2E sample client review");
  await contract.getByRole("button", { name: "Submit review" }).click();
  await expect(contract.getByText("E2E sample client review")).toBeVisible();

  await page.getByRole("button", { name: "Demo as Freelancer" }).click();
  await page.getByRole("navigation", { name: "Demo sections" }).getByRole("button", { name: "Contracts & Reviews" }).click();
  const freelancerContract = page.locator(".demo-contract").filter({ hasText: newTitle });
  await freelancerContract.getByLabel("Leave a 5-star sample review").fill("E2E sample freelancer review");
  await freelancerContract.getByRole("button", { name: "Submit review" }).click();
  await expect(freelancerContract.getByText("E2E sample freelancer review")).toBeVisible();

  await page.getByRole("navigation", { name: "Demo sections" }).getByRole("button", { name: "Daily Feed" }).click();
  await page.locator("#demo-post-body").fill("E2E professional update in isolated demo data.");
  await page.getByRole("button", { name: "Publish update" }).click();
  const post = page.locator(".demo-post").filter({ hasText: "E2E professional update in isolated demo data." });
  await expect(post).toBeVisible();
  await post.getByRole("button", { name: /Like/ }).click();
  await post.getByLabel("Write a comment").fill("E2E demo comment");
  await post.getByRole("button", { name: "Comment" }).click();
  await expect(post.getByText("E2E demo comment")).toBeVisible();
  await post.getByRole("button", { name: "Message author" }).click();
  await page.locator("#demo-message-draft").fill("E2E isolated sample message");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("E2E isolated sample message")).toBeVisible();

  expect(supabaseRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain("techkarvo-demo-v1");
  expect(keys.some((key) => key.includes("auth-token"))).toBe(false);

  await page.getByRole("button", { name: "Reset Demo" }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Maya" })).toBeVisible();
  await page.getByRole("navigation", { name: "Demo sections" }).getByRole("button", { name: "Job Feed & Applications" }).click();
  await expect(page.getByText(newTitle, { exact: true })).toHaveCount(0);
});

test("demo wallet, milestone escrow, membership and ad rewards stay simulated and resettable", async ({ page }) => {
  const supabaseRequests = [];
  page.on("request", (request) => {
    if (/supabase\.(co|in)\//i.test(request.url())) supabaseRequests.push(request.url().split("/").slice(0, 3).join("/"));
  });
  await page.goto("/demo");
  await expect(page.getByText("This is a local-only demo. Your actions never reach Supabase.")).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Demo sections" });
  await nav.getByRole("button", { name: "Membership & Rewards" }).click();
  await page.getByRole("button", { name: "Gold", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Selected tier: gold" })).toBeVisible();
  await page.getByRole("button", { name: /Simulate \+1 KAV reward/ }).click();
  await expect(page.getByRole("button", { name: /Simulate \+1 KAV reward · 1\/5/ })).toBeVisible();

  await nav.getByRole("button", { name: "KAV Wallet Sandbox" }).click();
  await page.getByRole("button", { name: "Simulate 100 USDT credit" }).click();
  await expect(page.getByTestId("demo-wallet-balance")).toHaveText("1,301");
  await expect(page.getByText("SIMULATED — NO FUNDS MOVED")).toBeVisible();

  await page.getByRole("button", { name: "Demo as Client" }).click();
  await nav.getByRole("button", { name: "KAV Wallet Sandbox" }).click();
  await page.getByRole("button", { name: "Fund sample milestone" }).click();
  await expect(page.getByText("funded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open sample dispute" }).click();
  await expect(page.getByText("disputed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resolve sample dispute: release" }).click();
  await expect(page.getByText("released", { exact: true })).toBeVisible();

  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain("techkarvo-demo-v1");
  expect(keys.some((key) => key.includes("auth-token"))).toBe(false);
  expect(supabaseRequests).toEqual([]);
  await page.getByRole("button", { name: "Reset Demo" }).click();
  await nav.getByRole("button", { name: "KAV Wallet Sandbox" }).click();
  await expect(page.getByTestId("demo-wallet-balance")).toHaveText("1,200");
  await expect(page.getByText("unfunded", { exact: true })).toBeVisible();
});

test("theme preference persists, keyboard controls work, and layouts fit mobile and tablet", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to light theme" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 850 });
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 2);
    await expect(page.getByRole("button", { name: "Demo as Freelancer" })).toBeVisible();
    await page.getByRole("button", { name: "Demo as Freelancer" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Welcome, Maya" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
