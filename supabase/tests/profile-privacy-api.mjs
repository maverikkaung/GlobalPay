import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

const origin = "http://127.0.0.1:5188";
const secret = process.env.TK_PROFILE_TEST_JWT_SECRET;
assert.ok(secret?.length >= 32, "An isolated API fixture signing secret is required.");

const owner = "94000000-0000-4000-8000-000000000001";
const client = "94000000-0000-4000-8000-000000000002";
const blockedClient = "94000000-0000-4000-8000-000000000003";
const outsider = "94000000-0000-4000-8000-000000000004";

function tokenFor(subject) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = encode({ sub: subject, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 });
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${claims}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}

async function get(resource, query, subject, status = 200) {
  const url = new URL(`/${resource}`, origin);
  url.search = new URLSearchParams(query);
  const response = await fetch(url, {
    headers: subject ? { Authorization: `Bearer ${tokenFor(subject)}` } : {},
    redirect: "error",
    signal: AbortSignal.timeout(8000)
  });
  assert.equal(response.status, status, `Unexpected status for ${resource}`);
  return response.json();
}

test("anonymous API readers cannot read discovery views, portfolio, connections or safety labels", async () => {
  for (const resource of ["freelancer_public_profiles", "client_public_profiles", "reviews_public",
    "portfolio_items", "connections", "rpc/techkarvo_my_blocked_member_labels"]) {
    assert.equal((await get(resource, {}, null, 401)).code, "42501");
  }
});

test("owners and unblocked clients can read the authorized profile and portfolio", async () => {
  for (const subject of [owner, client]) {
    assert.deepEqual(await get("freelancer_public_profiles", { id: `eq.${owner}`, select: "id,full_name" }, subject),
      [{ id: owner, full_name: "Fixture Freelancer" }]);
    assert.deepEqual(await get("portfolio_items", { freelancer_id: `eq.${owner}`, select: "title" }, subject),
      [{ title: "Fixture project" }]);
  }
  assert.deepEqual(await get("client_public_profiles", { id: `eq.${client}`, select: "id" }, owner), [{ id: client }]);
});

test("an unrelated authenticated account cannot read another member's private base row or relationship", async () => {
  assert.deepEqual(await get("profiles", { id: `eq.${owner}`, select: "id" }, outsider), []);
  assert.deepEqual(await get("connections", { recipient_id: `eq.${owner}`, select: "id" }, outsider), []);
  assert.deepEqual(await get("portfolio_items", { freelancer_id: `eq.${owner}`, select: "id" }, outsider), []);
  const ownReview = { reviewer_id: `eq.${client}`, select: "application_id" };
  assert.deepEqual(await get("reviews", ownReview, outsider), []);
  assert.deepEqual(await get("reviews", ownReview, client), [{ application_id: "privacy-fixture-1" }]);
});

test("a bilateral block suppresses profile, portfolio and connection discovery", async () => {
  assert.deepEqual(await get("freelancer_public_profiles", { id: `eq.${owner}`, select: "id" }, blockedClient), []);
  assert.deepEqual(await get("client_public_profiles", { id: `eq.${blockedClient}`, select: "id" }, owner), []);
  assert.deepEqual(await get("portfolio_items", { freelancer_id: `eq.${owner}`, select: "id" }, blockedClient), []);
  for (const subject of [owner, blockedClient]) {
    assert.deepEqual(await get("connections", { requester_id: `eq.${blockedClient}`, select: "id" }, subject), []);
  }
  assert.equal((await get("connections", { requester_id: `eq.${client}`, select: "id" }, owner)).length, 1);
});

test("reviews filter the blocked subject and author while retaining allowed reviews", async () => {
  const query = { reviewee_id: `eq.${owner}`, select: "body,rating" };
  assert.deepEqual(await get("reviews_public", query, client), [{ body: "Clear communication", rating: 4 }]);
  assert.deepEqual(await get("reviews_public", query, blockedClient), []);
  assert.deepEqual(await get("reviews_public", { reviewee_id: `eq.${outsider}`, select: "id" }, owner), []);
});

test("the safety-label API returns only the caller's authored block entries", async () => {
  const resource = "rpc/techkarvo_my_blocked_member_labels";
  assert.deepEqual(await get(resource, {}, owner), [{ id: blockedClient, full_name: "Blocked Client" }]);
  for (const subject of [client, blockedClient, outsider]) {
    assert.deepEqual(await get(resource, {}, subject), []);
  }
});

test("the active-work safeguard does not disclose unrelated project relationships", async () => {
  const resource = "rpc/techkarvo_has_active_work";
  const query = { p_user_a: client, p_user_b: outsider };
  assert.equal((await get(resource, query, null, 401)).code, "42501");
  assert.equal(await get(resource, query, owner), false);
  assert.equal(await get(resource, query, client), true);
  assert.equal(await get(resource, query, outsider), true);
});
