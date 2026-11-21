import { test, expect } from "@playwright/test";

const backend = "https://e2e-placeholder.invalid";
const client = "10000000-0000-4000-8000-000000000001";
const freelancer = "10000000-0000-4000-8000-000000000002";
const thread = "10000000-0000-4000-8000-000000000003";
const connection = "10000000-0000-4000-8000-000000000004";
const hiddenAt = "2026-11-20T12:00:00.123456+00:00";
const message = (id, sender_id, body, created_at) => ({ id, sender_id, body, created_at, read_at: null, conversation_id: thread });

async function mockInbox(page, baseURL, messages) {
  const writes = [];
  const probes = [];
  const appOrigin = new URL(baseURL).origin;
  await page.addInitScript(({ id, origin }) => {
    if (location.origin !== origin) return;
    localStorage.setItem("sb-e2e-placeholder-auth-token", JSON.stringify({
      access_token: "isolated-fixture", refresh_token: "isolated-fixture", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id }
    }));
  }, { id: client, origin: appOrigin });
  await page.routeWebSocket(`${backend.replace("https:", "wss:")}/**`, (socket) => socket.close());
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    if (url.origin !== backend) return route.abort();
    const method = request.method();
    const table = url.pathname.replace("/rest/v1/", "");
    const query = Object.fromEntries(url.searchParams);
    if (method === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "*/0" } });
    if (table === "rpc/techkarvo_is_platform_admin") return route.fulfill({ json: false });
    if (method !== "GET") {
      writes.push({ method, table, query });
      if (method === "DELETE" && table === "conversation_hides") {
        return route.fulfill({ status: 403, json: { code: "42501", message: "Fixture hide is preserved" } });
      }
      return route.fulfill({ status: 204 });
    }
    if (table === "profiles") return route.fulfill({ json: [{ full_name: "Isolated client", account_type: "client" }] });
    if (table === "conversation_hides") return route.fulfill({ json: [{ conversation_id: thread, hidden_at: hiddenAt }] });
    if (table === "conversations") return route.fulfill({ json: [{
      id: thread, client_id: client, freelancer_id: freelancer,
      application_id: `connection:${connection}`, job_id: `connection:${connection}`
    }] });
    if (table === "connections") return route.fulfill({ json: [{ id: connection, status: "Accepted" }] });
    if (table === "freelancer_public_profiles") return route.fulfill({ json: [{ id: freelancer, full_name: "Isolated freelancer" }] });
    if (table === "messages" && query.created_at) {
      probes.push(query);
      const rows = messages.filter((row) => query.conversation_id === `eq.${row.conversation_id}`
        && query.sender_id !== `neq.${row.sender_id}` && `gt.${row.created_at}` > query.created_at);
      return route.fulfill({ json: rows.slice(0, 1).map(({ id }) => ({ id })) });
    }
    if (table === "messages" && query.conversation_id === `eq.${thread}`) return route.fulfill({ json: messages });
    return route.fulfill({ json: [] });
  });
  return { writes, probes };
}

test("old, equal-time, and self-sent messages keep a conversation hidden", async ({ page, baseURL }) => {
  const { probes, writes } = await mockInbox(page, baseURL, [
    message("old", freelancer, "Older inbound", "2026-11-20T12:00:00.123455+00:00"),
    message("equal", freelancer, "Equal timestamp", hiddenAt),
    message("self", client, "Newer self message", "2026-11-20T12:00:00.123457+00:00")
  ]);
  await page.goto(`/messages?conversation=${thread}`);
  await page.getByRole("tab", { name: /Personal Messages/ }).click();
  await expect(page.getByText("No personal conversations yet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Select a conversation" })).toBeVisible();
  expect(probes).toContainEqual({ select: "id", conversation_id: `eq.${thread}`, sender_id: `neq.${client}`,
    created_at: `gt.${hiddenAt}`, limit: "1" });
  expect(writes).toEqual([]);
});

test("an incoming message reopens its thread when clearing the older hide is denied", async ({ page, baseURL }) => {
  const { writes } = await mockInbox(page, baseURL, [
    message("new", freelancer, "New inbound survives denied cleanup", "2026-11-20T12:00:00.123457+00:00")
  ]);
  await page.goto(`/messages?conversation=${thread}`);
  await expect(page.getByRole("tab", { name: /Personal Messages/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("New inbound survives denied cleanup")).toBeVisible();
  await expect(page.getByText("Unable to load conversations. Please try again.")).toHaveCount(0);
  expect(writes.filter(({ method }) => method === "DELETE")).toEqual([{
    method: "DELETE", table: "conversation_hides", query: {
      user_id: `eq.${client}`, conversation_id: `eq.${thread}`, hidden_at: `eq.${hiddenAt}`
    }
  }]);
});
