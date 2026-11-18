export function classifyConversation(applicationId) {
  return typeof applicationId === "string" && applicationId.startsWith("connection:") ? "personal" : "job";
}

export function getConversationsForFolder(conversations, folder) {
  return conversations.filter((conversation) => conversation.messageFolder === folder);
}

export function countUnreadByFolder(conversations) {
  return conversations.reduce((totals, conversation) => {
    const folder = conversation.messageFolder === "personal" ? "personal" : "job";
    totals[folder] += Number.isFinite(conversation.unreadCount) ? conversation.unreadCount : 0;
    return totals;
  }, { job: 0, personal: 0 });
}
