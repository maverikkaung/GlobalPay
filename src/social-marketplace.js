export const MARKETPLACE_MEDIA_BUCKET = "techkarvo-marketplace";
export const MAX_MARKETPLACE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MARKETPLACE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function resolveSocialPageUser(suppliedUser, authenticatedUser) {
  return suppliedUser?.id && suppliedUser.accountType ? suppliedUser : authenticatedUser;
}

export function isValidMarketplaceImage(file) {
  return Boolean(file && MARKETPLACE_IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_MARKETPLACE_IMAGE_BYTES);
}

export function getConnectionForPair(connections, userId, otherId) {
  return connections.find((item) =>
    (item.requester_id === userId && item.recipient_id === otherId)
    || (item.requester_id === otherId && item.recipient_id === userId)
  ) || null;
}

export function buildSocialFeed(posts, profiles, mutedUserIds = []) {
  const mutedIds = new Set(mutedUserIds);
  const postItems = posts.filter((post) => !mutedIds.has(post.author_id))
    .map((post) => ({ ...post, feedType: "post", author: profiles[post.author_id] || null }));
  return postItems.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export function updateSocialPost(items, postId, changes) {
  return items.map((item) => item.feedType === "post" && item.id === postId
    ? { ...item, ...changes }
    : item);
}

export function mapPostEngagement(items, likes, comments, profiles, userId) {
  const likesByPost = new Map();
  for (const like of likes) {
    const group = likesByPost.get(like.post_id) || { count: 0, liked: false };
    group.count += 1;
    if (like.user_id === userId) group.liked = true;
    likesByPost.set(like.post_id, group);
  }
  const commentsByPost = new Map();
  for (const comment of comments) {
    const group = commentsByPost.get(comment.post_id) || [];
    group.push({ ...comment, author: profiles[comment.author_id] || null });
    commentsByPost.set(comment.post_id, group);
  }
  return items.map((item) => item.feedType === "post" ? {
    ...item,
    likeCount: likesByPost.get(item.id)?.count || 0,
    likedByMe: likesByPost.get(item.id)?.liked || false,
    comments: commentsByPost.get(item.id) || []
  } : item);
}
