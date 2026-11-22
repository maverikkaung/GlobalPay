import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const backend = "https://e2e-placeholder.invalid";
const client = "30000000-0000-4000-8000-000000000001";
const freelancer = "30000000-0000-4000-8000-000000000002";
const outsider = "30000000-0000-4000-8000-000000000003";
const id = "30000000-0000-4000-8000-000000000004";
const jobId = "30000000-0000-4000-8000-000000000005";
const applicationId = "30000000-0000-4000-8000-000000000006";
const threadId = "30000000-0000-4000-8000-000000000007";
const workroom = `/contracts/${id}`;
const thread = { id: threadId, application_id: applicationId, client_id: client, freelancer_id: freelancer, job_id: jobId, created_at: "2026-11-20T12:00:00Z" };

async function fixture(page, baseURL, { user = client, status = "active", noThread = false, noMilestones = false, deny = false,
  contractFails = () => false, deliveries = [], onRequest, jobStatus = "open", reviews = [] } = {}) {
  const origin = new URL(baseURL).origin;
  const requests = [];
  if (user) await page.addInitScript(({ origin, user }) => {
    if (location.origin === origin) localStorage.setItem("sb-e2e-placeholder-auth-token", JSON.stringify({
      access_token: "fixture", refresh_token: "fixture", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user }
    }));
  }, { origin, user });
  await page.routeWebSocket("wss://e2e-placeholder.invalid/**", (socket) => socket.close());
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== backend) return route.abort();
    const method = request.method();
    const table = url.pathname.replace("/rest/v1/", "");
    requests.push({ method, table });
    const override = onRequest?.({ route, table, method });
    if (override) return override;
    if (method === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "*/0" } });
    if (table === "rpc/techkarvo_is_platform_admin") return route.fulfill({ json: false });
    if (table === "rpc/techkarvo_sandbox_wallet") return route.fulfill({ json: { available_kav: 0, transactions: [] } });
    if (table === "contracts") {
      if (deny) return route.fulfill({ json: [] });
      if (contractFails()) return route.fulfill({ status: 400, json: { code: "PGRST000" } });
      return route.fulfill({ json: [{ ...thread, id, status, completed_at: status === "completed" ? "2026-11-21T12:00:00Z" : null }] });
    }
    const rows = {
      profiles: [{ full_name: "Fixture member", account_type: user === freelancer ? "freelancer" : "client" }],
      client_public_profiles: [{ id: client, full_name: "Studio Client" }],
      freelancer_public_profiles: [{ id: freelancer, full_name: "Design Freelancer", professional_title: "Designer" }],
      job_applications: [{ ...thread, id: applicationId, full_name: "Design Freelancer", status: "Accepted", applied_at: "2026-11-19T12:00:00Z" }],
      jobs: [{ id: jobId, title: "Design a storefront", status: jobStatus }],
      contract_deliveries: deliveries,
      reviews,
      conversations: noThread ? [] : [thread],
      messages: [{ id: "message", conversation_id: threadId, sender_id: freelancer, body: "Original conversation history",
        created_at: "2026-11-20T12:00:00Z", read_at: "2026-11-20T12:04:00Z" }],
      contract_milestones: noMilestones ? [] : [{ id: "milestone", contract_id: id, title: "Prototype", status: "submitted", amount_kav: 50 }],
      milestone_events: [{ id: 1, milestone_id: "milestone", event_type: "submitted", created_at: "2026-11-21T10:00:00Z" }]
    };
    return route.fulfill({ json: rows[table] || [] });
  });
  return requests;
}

test("accepted client and freelancer applications open the same workroom and existing conversation", async ({ browser, baseURL }) => {
  for (const [user, path] of [[client, "/job-applicants"], [freelancer, "/my-applications"]]) {
    const page = await browser.newPage({ baseURL });
    const requests = await fixture(page, baseURL, { user });
    await page.goto(path);
    await page.getByRole("link", { name: "Open Contract Workroom" }).click();
    await expect(page).toHaveURL(workroom);
    await page.getByRole("link", { name: "Related Messages" }).click();
    await expect(page).toHaveURL(`/messages?conversation=${threadId}`);
    await expect(page.getByText("Original conversation history")).toBeVisible();
    await page.getByRole("link", { name: "Open Contract Workroom" }).click();
    await expect(page).toHaveURL(workroom);
    expect(requests.filter(({ method, table }) => method === "POST" && table === "conversations")).toEqual([]);
    await page.close();
  }
});

test("an unavailable explicit chat link does not open or mark another conversation read", async ({ page, baseURL }) => {
  const requests = await fixture(page, baseURL);
  await page.goto("/messages?conversation=30000000-0000-4000-8000-000000000099");
  await expect(page.getByRole("alert")).toContainText("This conversation is unavailable or hidden.");
  await expect(page.getByText("Original conversation history")).toHaveCount(0);
  expect(requests.filter(({ method, table }) => method === "PATCH" && ["messages", "notifications"].includes(table))).toEqual([]);
});

test("workroom navigation is keyboard reachable and fits responsive widths in both themes", async ({ page, baseURL }) => {
  await fixture(page, baseURL);
  await page.goto(workroom);
  const chat = page.getByRole("link", { name: "Related Messages" });
  await expect(chat).toBeVisible();
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    await expect(page.locator(".job-journey")).toHaveCSS("background-color", theme === "dark" ? "rgb(11, 20, 36)" : "rgb(245, 247, 251)");
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
  await chat.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Related Job" })).toBeFocused();
});

for (const [role, user] of [["Client", client], ["Freelancer", freelancer]]) {
  test(`${role} can read contract context and existing chat links without mutating the workroom`, async ({ page, baseURL }) => {
    const requests = await fixture(page, baseURL, { user });
    await page.goto(workroom);
    await expect(page.getByRole("heading", { name: "Design a storefront" })).toBeVisible();
    await expect(page.getByText("Design Freelancer", { exact: true })).toBeVisible();
    await expect(page.getByText("50.00 simulated KAV")).toBeVisible();
    await expect(page.getByText("Prototype · Work submitted")).toBeVisible();
    await expect(page.getByRole("link", { name: "Related Messages" })).toHaveAttribute("href", `/messages?conversation=${threadId}`);
    await expect(page.getByRole("link", { name: "Related Job" })).toHaveAttribute("href", `/jobs/${jobId}`);
    await expect(page.getByRole("link", { name: "Milestone Sandbox" })).toHaveAttribute("href", `/financial-sandbox?contract=${id}#milestones`);
    expect(requests.filter(({ method, table }) => !["HEAD", "GET"].includes(method) && table !== "rpc/techkarvo_is_platform_admin")).toEqual([]);
    if (role === "Client") {
      await page.getByRole("link", { name: "Milestone Sandbox" }).click();
      await expect(page.getByRole("region", { name: "Simulated milestones" })).toBeFocused();
      await expect(page.locator(".financial-contract-card")).toHaveCount(1);
    }
  });
}

test("anonymous and unrelated users cannot load private workroom data", async ({ browser, baseURL }) => {
  const guest = await browser.newPage({ baseURL });
  const guestRequests = await fixture(guest, baseURL, { user: null });
  await guest.goto(workroom);
  await expect(guest).toHaveURL(/\/login$/);
  expect(guestRequests.some(({ table }) => table === "contracts")).toBe(false);
  await guest.close();
  const other = await browser.newPage({ baseURL });
  // Reject a mismatched row even if the primary endpoint returns one.
  const requests = await fixture(other, baseURL, { user: outsider });
  await other.goto(workroom);
  await expect(other.getByRole("heading", { name: "Contract unavailable" })).toBeVisible();
  expect(requests.some(({ table }) => ["job_applications", "conversations", "contract_milestones", "contract_deliveries"].includes(table))).toBe(false);
  await other.close();
});

for (const [status, label] of [["completed", "Completed"], ["disputed", "Disputed"], ["cancelled", "Cancelled"]]) {
  test(`${status} workroom distinguishes contract state from sandbox payment and missing related data`, async ({ page, baseURL }) => {
    let fails = status === "cancelled";
    await fixture(page, baseURL, { status, noThread: true, noMilestones: true, contractFails: () => fails });
    await page.goto(workroom);
    if (status === "cancelled") {
      await expect(page.getByRole("alert")).toContainText("Could not load the workroom");
      fails = false;
      await page.getByRole("button", { name: "Try again" }).click();
    }
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByText("Simulated only")).toBeVisible();
    await expect(page.getByText("No sandbox milestones yet.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Related Messages" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Milestone Sandbox" })).toHaveCount(status === "disputed" ? 1 : 0);
  });
}

const attachment = `${id}/${freelancer}/30000000-0000-4000-8000-000000000050/1.pdf`;
const submitted = { id: "v1", version: 1, description: "Initial design files",
  project_url: "https://example.invalid/storefront", attachment_paths: [attachment],
  status: "submitted", submitted_at: "2026-11-21T12:00:00Z" };

test("freelancer retries interrupted upload and ambiguous submission with the same request", async ({ page, baseURL }) => {
  const deliveries = [{ ...submitted, status: "revision_requested", feedback: "Update the mobile design." }];
  const uploads = [];
  const submissions = [];
  await fixture(page, baseURL, { user: freelancer, deliveries, onRequest: ({ route, table, method }) => {
    if (method === "POST" && table.startsWith("/storage/v1/object/")) {
      uploads.push(table);
      if (uploads.length === 1) return route.fulfill({ status: 503, json: { message: "Interrupted" } });
      return route.fulfill({ status: 400, json: { statusCode: "400", error: "Duplicate", message: "The resource already exists" } });
    }
    if (table === "rpc/techkarvo_submit_delivery") {
      const request = route.request().postDataJSON();
      submissions.push(request);
      if (submissions.length === 1) {
        deliveries.unshift({ ...submitted, id: "v2", version: 2, description: request.p_description,
          project_url: request.p_project_url, attachment_paths: request.p_attachment_paths });
        return route.fulfill({ status: 503, json: { code: "PGRST000" } });
      }
      return route.fulfill({ json: "v2" });
    }
  } });
  await page.goto(workroom);
  await expect(page.getByRole("heading", { name: "Submit revised work" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept work" })).toHaveCount(0);
  await page.getByLabel("Delivery description").fill("Updated layout for small screens");
  await page.getByLabel("Project link (optional)").fill("https://example.invalid/revision");
  await page.getByLabel("Private attachments (optional)").setInputFiles({
    name: "revision.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 testing")
  });
  await page.getByRole("button", { name: "Submit delivery" }).evaluate((button) => { button.click(); button.click(); });
  await expect(page.getByRole("alert")).toContainText("Delivery could not be confirmed");
  expect(uploads).toHaveLength(1);
  expect(submissions).toHaveLength(0);
  await expect(page.getByLabel("Delivery description")).toHaveValue("Updated layout for small screens");
  await page.getByRole("button", { name: "Retry submission" }).click();
  await expect(page.getByRole("alert")).toContainText("Delivery could not be confirmed");
  expect(uploads).toHaveLength(2);
  expect(uploads[0]).toBe(uploads[1]);
  await page.getByRole("button", { name: "Retry submission" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Delivery submitted" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Version 2" })).toBeVisible();
  await expect(page.getByText("Update the mobile design.")).toBeVisible();
  expect(uploads).toHaveLength(2);
  expect(submissions).toHaveLength(2);
  expect(submissions[0]).toEqual(submissions[1]);
  expect(submissions[0].p_expected_latest).toBe("v1");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});

test("client can sign a private attachment, request a revision and handle a stale decision", async ({ page, baseURL }) => {
  const deliveries = [{ ...submitted }];
  const decisions = [];
  await fixture(page, baseURL, { deliveries, onRequest: ({ route, table }) => {
    if (table === "/storage/v1/object/sign/download") {
      return route.fulfill({ headers: { "content-disposition": 'attachment; filename="work.pdf"' }, body: "%PDF-1.4 testing" });
    }
    if (table.startsWith("/storage/v1/object/sign/")) {
      expect(table).toBe(`/storage/v1/object/sign/techkarvo-contract-deliveries/${attachment}`);
      expect(route.request().postDataJSON()).toEqual({ expiresIn: 60 });
      return route.fulfill({ json: { signedURL: "/object/sign/download?token=fixture" } });
    }
    if (table === "rpc/techkarvo_decide_delivery") {
      const request = route.request().postDataJSON();
      decisions.push(request);
      const version = deliveries[0];
      version.decided_at = "2026-11-22T12:00:00Z";
      version.status = request.p_decision;
      version.feedback = request.p_feedback;
      if (request.p_decision === "approved") return route.fulfill({ status: 409, json: { code: "PT409" } });
      return route.fulfill({ json: version.id });
    }
  } });
  await page.goto(workroom);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download attachment 1 (PDF)" }).click();
  expect((await download).suggestedFilename()).toBe("work.pdf");
  await expect(page.getByRole("heading", { name: "Submit work" })).toHaveCount(0);
  await page.getByRole("button", { name: "Request revision" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter feedback");
  await expect(page.getByLabel("Feedback for revision requests")).toBeFocused();
  expect(decisions).toHaveLength(0);
  await page.getByLabel("Feedback for revision requests").fill("Please update the navigation.");
  await page.getByRole("button", { name: "Request revision" }).click();
  await expect(page.getByText("Please update the navigation.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept work" })).toHaveCount(0);
  deliveries.unshift({ ...submitted, id: "v2", version: 2, attachment_paths: [], description: "Updated files" });
  await page.reload();
  await page.getByRole("button", { name: "Accept work" }).evaluate((button) => { button.click(); button.click(); });
  await expect(page.getByRole("alert")).toContainText("The delivery changed");
  await expect(page.getByText("Work accepted", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review this project" })).toHaveCount(0);
  expect(decisions.map((decision) => decision.p_delivery_id)).toEqual(["v1", "v2"]);
});

test("client can accept work after a failed delivery-history read without completing the contract", async ({ page, baseURL }) => {
  const deliveries = [{ ...submitted, attachment_paths: [] }];
  let failRead = true;
  await fixture(page, baseURL, { deliveries, onRequest: ({ route, table }) => {
    if (table === "contract_deliveries" && failRead) {
      return route.fulfill({ status: 500, json: { code: "PGRST000" } });
    }
    if (table === "rpc/techkarvo_decide_delivery") {
      expect(route.request().postDataJSON()).toEqual({
        p_contract_id: id, p_delivery_id: "v1", p_decision: "approved", p_feedback: null
      });
      deliveries[0] = { ...deliveries[0], status: "approved", decided_at: "2026-11-22T12:00:00Z" };
      return route.fulfill({ json: "v1" });
    }
  } });
  await page.goto(workroom);
  await expect(page.getByRole("alert")).toContainText("Could not load deliveries");
  await expect(page.getByRole("button", { name: "Accept work" })).toHaveCount(0);
  failRead = false;
  await page.getByRole("button", { name: "Reload deliveries" }).click();
  await page.getByRole("button", { name: "Accept work" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Work accepted." })).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review this project" })).toHaveCount(0);
});

test("completed workroom opens only the matching review and an existing review is excluded", async ({ page, baseURL }) => {
  const reviews = [];
  await fixture(page, baseURL, { status: "completed", jobStatus: "completed", reviews, onRequest: ({ route, table, method }) => {
    if (table === "reviews" && method === "POST") {
      const payload = route.request().postDataJSON();
      expect(payload).toMatchObject({ application_id: applicationId, reviewer_id: client, reviewee_id: freelancer });
      reviews.push({ application_id: applicationId });
      return route.fulfill({ status: 201 });
    }
  } });
  await page.goto(workroom);
  await page.getByRole("link", { name: "Review this project" }).click();
  await expect(page).toHaveURL(`/reviews?contract=${id}`);
  await expect(page.getByRole("heading", { name: "Review Design Freelancer" })).toBeVisible();
  await page.getByRole("button", { name: "Submit Review" }).click();
  await expect(page.getByRole("status")).toHaveText("Your review was submitted.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "No reviews to write" })).toBeVisible();
  expect(reviews).toHaveLength(1);
});

test("review list excludes noncompleted linked contracts while preserving legacy jobs", async ({ browser, baseURL }) => {
  for (const [status, deny, canReview] of [["disputed", false, false], ["completed", true, true]]) {
    const page = await browser.newPage({ baseURL });
    await fixture(page, baseURL, { status, deny, jobStatus: "completed" });
    await page.goto("/reviews");
    await expect(page.getByRole("heading", { name: canReview ? "Review Design Freelancer" : "No reviews to write" })).toBeVisible();
    await page.close();
  }
});
