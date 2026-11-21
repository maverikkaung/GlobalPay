import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { guardQaDeletions } from "./qa-deletion-guard.js";

const origin = "https://ntucgiieksrwebwvcmun.supabase.co";
const owner = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const post = "10000000-0000-4000-8000-000000000003";
const message = "10000000-0000-4000-8000-000000000004";
const asset = `${owner}/10000000-0000-4000-8000-000000000005.png`;
const fixture = Buffer.from("synthetic QA image");
const storage = "/storage/v1/object/techkarvo-marketplace";
const body = "QA fixture from this run";
const olderAsset = `${owner}/10000000-0000-4000-8000-000000000006.png`;

function response(method, path, { payload, status = 201, headers = {}, json } = {}) {
  return {
    request: () => ({ method: () => method, url: () => origin + path, postDataJSON: () => payload,
      postDataBuffer: () => payload, headers: () => headers }),
    url: () => origin + path,
    status: () => status,
    ok: () => status >= 200 && status < 300,
    json: async () => json
  };
}

async function setup() {
  let handle;
  let observe;
  const blocked = [];
  const page = {
    on(_event, listener) { observe = listener; },
    route(_matches, handler) { handle = handler; }
  };
  const guard = await guardQaDeletions(page, owner, other, fixture, blocked);
  const send = (method, path, data) => handle({
    request: () => ({ method: () => method, url: () => origin + path, postDataJSON: () => data }),
    fallback: () => "allowed",
    fulfill: ({ status }) => status
  });
  return { guard, send, blocked, observe };
}

test("QA guard rejects unverified records and requires the recorded post owner", async () => {
  const { guard, send, blocked } = await setup();
  const deletePost = (author) => send("DELETE", `/rest/v1/posts?id=eq.${post}&author_id=eq.${author}`);
  const removeMessage = () => send("POST", "/rest/v1/rpc/techkarvo_delete_message_for_everyone", { p_message_id: message });
  assert.equal(await deletePost(owner), 403);
  assert.equal(await removeMessage(), 403);
  await assert.rejects(guard.recordPost(response("POST", "/rest/v1/posts", {
    status: 409, payload: { author_id: owner, body }, json: { id: post }
  }), body));
  await guard.recordPost(response("POST", "/rest/v1/posts", { payload: { author_id: owner, body }, json: { id: post } }), body);
  const insertion = response("POST", "/rest/v1/messages", { payload: { sender_id: owner, conversation_id: post, body } });
  const read = (conversation_id) => response("GET", "/rest/v1/messages", {
    status: 200, json: [{ id: message, sender_id: owner, conversation_id, body }]
  });
  await assert.rejects(guard.recordMessage(insertion, read(other), body));
  await guard.recordMessage(insertion, read(post), body);
  assert.equal(await deletePost(other), 403);
  assert.equal(await deletePost(owner), "allowed");
  assert.equal(await removeMessage(), "allowed");
  assert.deepEqual(blocked, ["post", "message", "post"]);
});

test("QA guard removes only QA fixture media created without upsert in this run", async () => {
  const { send, observe } = await setup();
  const remove = (...prefixes) => send("DELETE", storage, { prefixes });
  const upload = (headers, payload = fixture, status = 200) => observe(response("POST", `${storage}/${asset}`, { headers, payload, status }));
  upload({ "x-upsert": "true" });
  upload({ "x-upsert": "false" }, Buffer.from("other image"));
  upload({ "x-upsert": "false" }, fixture, 409);
  assert.equal(await remove(asset), 403);
  upload({ "x-upsert": "false" });
  assert.equal(await remove(asset, olderAsset), 403);
  assert.equal(await remove(olderAsset), 403);
  assert.equal(await remove(asset), "allowed");
});

test("QA guard never removes conversation hides or pre-existing safety settings", async () => {
  const { observe, send, blocked } = await setup();
  const params = `?user_id=eq.${owner}&muted_user_id=eq.${other}`;
  const payload = { user_id: owner, muted_user_id: other };
  observe(response("POST", "/rest/v1/muted_users", { payload, headers: { prefer: "resolution=merge-duplicates" } }));
  assert.equal(await send("DELETE", `/rest/v1/muted_users${params}`), 403);
  observe(response("POST", "/rest/v1/conversation_hides", { payload: { user_id: owner, conversation_id: post } }));
  assert.equal(await send("DELETE", `/rest/v1/conversation_hides?user_id=eq.${owner}&conversation_id=eq.${post}`), 403);
  observe(response("POST", "/rest/v1/muted_users", { payload }));
  assert.equal(await send("DELETE", `/rest/v1/muted_users${params}`), "allowed");
  assert.equal(await send("DELETE", `/rest/v1/muted_users${params}`), 403);
  assert.deepEqual(blocked, ["temporary safety setting", "conversation hide", "temporary safety setting"]);
});
