import { expect, test } from "@playwright/test";

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

async function fixture(page, baseURL, { user = client, status = "active", noThread = false, noMilestones = false, deny = false, contractFails = () => false } = {}) {
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
      jobs: [{ id: jobId, title: "Design a storefront", status: "open" }],
      conversations: noThread ? [] : [thread],
      contract_milestones: noMilestones ? [] : [{ id: "milestone", contract_id: id, title: "Prototype", status: "submitted", amount_kav: 50 }],
      milestone_events: [{ id: 1, milestone_id: "milestone", event_type: "submitted", created_at: "2026-11-21T10:00:00Z" }]
    };
    return route.fulfill({ json: rows[table] || [] });
  });
  return requests;
}

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
  expect(requests.some(({ table }) => ["job_applications", "conversations", "contract_milestones"].includes(table))).toBe(false);
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
