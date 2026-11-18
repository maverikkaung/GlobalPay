import test from "node:test";
import assert from "node:assert/strict";
import { buildSocialFeed, getConnectionForPair, isValidMarketplaceImage, mapPostEngagement } from "./social-marketplace.js";

test("role-based feeds show the other side's work and real client jobs", () => {
  const profiles = {
    client: { id: "client", account_type: "client" },
    freelancer: { id: "freelancer", account_type: "freelancer" },
    self: { id: "self", account_type: "client" }
  };
  const posts = [
    { id: "fp", author_id: "freelancer", created_at: "2026-11-18T02:00:00Z" },
    { id: "cp", author_id: "client", created_at: "2026-11-18T01:00:00Z" },
    { id: "own", author_id: "self", created_at: "2026-11-18T00:00:00Z" }
  ];
  const jobs = [{ id: "job", client_id: "client", created_at: "2026-11-18T03:00:00Z" }];
  assert.deepEqual(buildSocialFeed(posts, jobs, profiles, "Client", "self").map((item) => item.id), ["fp", "own"]);
  assert.deepEqual(buildSocialFeed(posts, jobs, profiles, "Freelancer", "freelancer").map((item) => item.id), ["job", "fp", "cp", "own"]);
});

test("connection lookup finds the same pair in either direction", () => {
  const rows = [{ id: "c1", requester_id: "client", recipient_id: "freelancer", status: "Pending" }];
  assert.equal(getConnectionForPair(rows, "freelancer", "client").id, "c1");
  assert.equal(getConnectionForPair(rows, "client", "other"), null);
});

test("post engagement derives current user's like state and safe author projections", () => {
  const result = mapPostEngagement(
    [{ id: "post", author_id: "author", feedType: "post" }],
    [{ post_id: "post", user_id: "viewer" }, { post_id: "post", user_id: "author" }],
    [{ id: "comment", post_id: "post", author_id: "author", body: "Thanks" }],
    { author: { id: "author", full_name: "Public author" } },
    "viewer"
  );
  assert.equal(result[0].likeCount, 2);
  assert.equal(result[0].likedByMe, true);
  assert.equal(result[0].comments[0].author.full_name, "Public author");
});

test("marketplace uploads accept only size-limited JPEG, PNG, and WebP images", () => {
  assert.equal(isValidMarketplaceImage({ type: "image/webp", size: 10 }), true);
  assert.equal(isValidMarketplaceImage({ type: "image/svg+xml", size: 10 }), false);
  assert.equal(isValidMarketplaceImage({ type: "image/png", size: 6 * 1024 * 1024 }), false);
  assert.equal(isValidMarketplaceImage(null), false);
});
