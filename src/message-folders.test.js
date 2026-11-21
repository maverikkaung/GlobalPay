import test from "node:test";
import assert from "node:assert/strict";
import { classifyConversation, countUnreadByFolder, getConversationsForFolder, isApplicationMessagingOpen } from "./message-folders.js";

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
