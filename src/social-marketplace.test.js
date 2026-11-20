import test from "node:test";
import assert from "node:assert/strict";
import { buildSocialFeed, getConnectionForPair, isValidMarketplaceImage, mapPostEngagement, resolveSocialPageUser, updateSocialPost } from "./social-marketplace.js";

test("standalone Daily Feed resolves the authenticated user when its route provides no prop", () => {
  const authenticatedUser = { id: "freelancer-id", accountType: "Freelancer" };
  assert.equal(resolveSocialPageUser(undefined, authenticatedUser), authenticatedUser);
  const suppliedUser = { id: "client-id", accountType: "Client" };
  assert.equal(resolveSocialPageUser(suppliedUser, authenticatedUser), suppliedUser);
  assert.equal(resolveSocialPageUser({ id: "missing-role" }, authenticatedUser), authenticatedUser);
});

test("the daily feed shows all social posts and never mixes in job offers", () => {
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
  assert.deepEqual(buildSocialFeed(posts, profiles).map((item) => item.id), ["fp", "cp", "own"]);
  assert.deepEqual(buildSocialFeed(posts, profiles, ["client"]).map((item) => item.id), ["fp", "own"]);
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

test("confirmed post edits replace stale feed content without changing other posts", () => {
  const feed = [
    { id: "post-1", feedType: "post", body: "Old content", author: { full_name: "Author" } },
    { id: "post-2", feedType: "post", body: "Keep this" }
  ];
  const updated = updateSocialPost(feed, "post-1", { body: "Updated content", updated_at: "2026-11-20T12:00:00Z" });
  assert.equal(updated[0].body, "Updated content");
  assert.equal(updated[0].author.full_name, "Author");
  assert.equal(updated[1], feed[1]);
});

test("marketplace uploads accept only size-limited JPEG, PNG, and WebP images", () => {
  assert.equal(isValidMarketplaceImage({ type: "image/webp", size: 10 }), true);
  assert.equal(isValidMarketplaceImage({ type: "image/svg+xml", size: 10 }), false);
  assert.equal(isValidMarketplaceImage({ type: "image/png", size: 6 * 1024 * 1024 }), false);
  assert.equal(isValidMarketplaceImage(null), false);
});
