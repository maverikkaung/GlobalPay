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

export function getHiddenConversationIdsWithNewIncoming(hiddenRows, incomingMessages, userId) {
  const hiddenAtByConversation = new Map((hiddenRows || []).map((row) => [row.conversation_id, Date.parse(row.hidden_at)]));
  return [...new Set((incomingMessages || []).filter((message) => {
    const hiddenAt = hiddenAtByConversation.get(message.conversation_id);
    return hiddenAt !== undefined && message.sender_id !== userId && Date.parse(message.created_at) > hiddenAt;
  }).map((message) => message.conversation_id))];
}
