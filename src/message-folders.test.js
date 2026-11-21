import test from "node:test";
import assert from "node:assert/strict";
import { classifyConversation, countUnreadByFolder, getConversationsForFolder, getHiddenConversationIdsWithNewIncoming, isApplicationMessagingOpen } from "./message-folders.js";

test("only accepted social connection threads are classified as personal", () => {
  assert.equal(classifyConversation("connection:abc"), "personal");
  assert.equal(classifyConversation("application-123"), "job");
  assert.equal(classifyConversation(null), "job");
});

test("job messaging remains available only for pending or accepted applications", () => {
  assert.equal(isApplicationMessagingOpen("Pending"), true);
  assert.equal(isApplicationMessagingOpen("Accepted"), true);
  for (const status of ["Rejected", "Withdrawn", "Completed", "Disputed", null, undefined]) {
    assert.equal(isApplicationMessagingOpen(status), false, `${status} must not open job messaging`);
  }
});

test("message folders filter conversations and count unread messages independently", () => {
  const rows = [
    { id: "job-1", messageFolder: "job", unreadCount: 2 },
    { id: "personal-1", messageFolder: "personal", unreadCount: 3 },
    { id: "job-2", messageFolder: "job", unreadCount: 1 }
  ];
  assert.deepEqual(getConversationsForFolder(rows, "personal").map((row) => row.id), ["personal-1"]);
  assert.deepEqual(countUnreadByFolder(rows), { job: 3, personal: 3 });
});

test("a new incoming message restores a hidden conversation without restoring old or self-sent messages", () => {
  const hidden = [{ conversation_id: "personal-1", hidden_at: "2026-11-20T12:00:00.000Z" }];
  const incoming = [
    { conversation_id: "personal-1", sender_id: "client", created_at: "2026-11-20T11:59:00.000Z" },
    { conversation_id: "personal-1", sender_id: "freelancer", created_at: "2026-11-20T12:01:00.000Z" },
    { conversation_id: "personal-1", sender_id: "client", created_at: "2026-11-20T12:02:00.000Z" }
  ];
  assert.deepEqual(getHiddenConversationIdsWithNewIncoming(hidden, incoming, "client"), ["personal-1"]);
  assert.deepEqual(getHiddenConversationIdsWithNewIncoming(hidden, incoming.slice(0, 1), "client"), []);
});
