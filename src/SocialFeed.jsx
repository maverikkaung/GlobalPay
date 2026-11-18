import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getRequestErrorMessage } from "./request-errors.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { buildSocialFeed, getConnectionForPair, isValidMarketplaceImage, mapPostEngagement, MARKETPLACE_MEDIA_BUCKET, resolveSocialPageUser } from "./social-marketplace.js";
import DashboardNav from "./DashboardNav.jsx";

function imageUrl(path) {
  if (!path) return "";
  return toSafeExternalUrl(supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(path).data?.publicUrl) || "";
}

function postPath(postId) {
  return `${window.location.origin}/social?post=${encodeURIComponent(postId)}`;
}

function SocialPost({ item, user, connection, busy, onLike, onComment, onCommentEdit, onCommentDelete, onEdit, onDelete, onConnect, onShare }) {
  const author = item.author;
  const name = author?.full_name || "TechKarvo member";
  const avatar = imageUrl(author?.avatar_path);
  const cover = item.image_path ? imageUrl(item.image_path) : "";
  const isOwn = item.author_id === user.id;
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingText, setEditingText] = useState("");

  async function submitComment(event) {
    event.preventDefault();
    const body = commentDraft.trim();
    if (!body) return;
    const saved = await onComment(item.id, body);
    if (saved) setCommentDraft("");
  }

  return <article className={`social-card${item.id ? ` social-card-${item.id}` : ""}`} id={item.id ? `social-post-${item.id}` : undefined}>
    <header className="social-card-author">
      <Link className="social-avatar-link" to={author?.id ? `/profiles/${author.id}` : "/social"} aria-label={`View ${name}'s profile`}>
        {avatar ? <img className="social-avatar" src={avatar} alt="" loading="lazy" /> : <span className="social-avatar social-avatar-fallback" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
      </Link>
      <div className="social-author-copy"><Link to={author?.id ? `/profiles/${author.id}` : "/social"}>{name}</Link>
        <span>{item.feedType === "job" ? "Client · New opportunity" : `${author?.professional_title || "TechKarvo member"}${author?.country ? ` · ${author.country}` : ""}`}</span>
        <time dateTime={item.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</time>
      </div>
      {item.feedType === "post" && <span className="social-type-label">{item.post_type === "service" ? "Service showcase" : "Professional update"}</span>}
    </header>

    {item.feedType === "job" ? <div className="social-job-content">
      <span className="social-eyebrow">JOB POST</span><h3>{item.title}</h3>
      <p>{item.description}</p>
      <div className="social-job-meta"><span>{item.category || "Other"}</span><strong>{item.currency || "USD"} {Number(item.budget).toLocaleString()}</strong></div>
      <Link className="social-primary-link" to={`/jobs/${item.id}`}>View job and apply</Link>
    </div> : <>
      {item.body && <p className="social-post-body">{item.body}</p>}
      {cover && <img className="social-post-image" src={cover} alt="Image shared in this professional post" loading="lazy" />}
      {item.portfolio_item_id && <Link className="social-portfolio-link" to={`/profiles/${item.author_id}`}>View the author's portfolio ↗</Link>}

      <div className="social-engagement-summary"><span>{item.likeCount} {item.likeCount === 1 ? "like" : "likes"}</span><span>{item.comments.length} {item.comments.length === 1 ? "comment" : "comments"}</span></div>
      <div className="social-post-actions">
        <button type="button" onClick={() => onLike(item)} disabled={busy}>{item.likedByMe ? "Unlike" : "Like"}</button>
        <button type="button" onClick={() => document.getElementById(`comment-${item.id}`)?.focus()}>Comment</button>
        <button type="button" onClick={() => onShare(item)}>Share</button>
        {!isOwn && <button type="button" className="social-connect-button" onClick={() => onConnect(item)} disabled={busy}>
          {connection?.status === "Accepted" ? "Message" : connection?.status === "Pending" && connection.requester_id === user.id ? "Request pending" : connection?.status === "Pending" ? "Accept connect" : connection?.status === "Declined" ? "Request declined" : "Connect"}
        </button>}
        {isOwn && <><button type="button" onClick={() => onEdit(item)}>Edit</button><button type="button" className="social-delete-button" onClick={() => onDelete(item)}>Delete</button></>}
      </div>

      <details className="social-comments" open={item.comments.length > 0}>
        <summary>Comments ({item.comments.length})</summary>
        <div className="social-comment-list">
          {item.comments.map((comment) => {
            const commentName = comment.author?.full_name || "TechKarvo member";
            const isCommentAuthor = comment.author_id === user.id;
            return <article className="social-comment" key={comment.id}>
              {editingCommentId === comment.id ? <form onSubmit={async (event) => {
                event.preventDefault();
                const changed = await onCommentEdit(comment.id, item.id, editingText);
                if (changed) setEditingCommentId("");
              }}><label className="visually-hidden" htmlFor={`edit-comment-${comment.id}`}>Edit comment</label>
                <textarea id={`edit-comment-${comment.id}`} value={editingText} maxLength={3000} onChange={(event) => setEditingText(event.target.value)} />
                <button type="submit" disabled={busy || !editingText.trim()}>Save</button><button type="button" onClick={() => setEditingCommentId("")}>Cancel</button>
              </form> : <><div className="social-comment-heading"><strong>{commentName}</strong><time dateTime={comment.created_at}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(comment.created_at))}</time></div><p>{comment.body}</p>
                {isCommentAuthor && <div className="social-comment-actions"><button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingText(comment.body); }}>Edit</button><button type="button" onClick={() => onCommentDelete(comment.id, item.id)}>Delete</button></div>}
              </>}
            </article>;
          })}
        </div>
        <form className="social-comment-form" onSubmit={submitComment}>
          <label className="visually-hidden" htmlFor={`comment-${item.id}`}>Write a comment</label>
          <textarea id={`comment-${item.id}`} maxLength={3000} rows={2} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Write a professional comment…" />
          <button type="submit" disabled={busy || !commentDraft.trim()}>Comment</button>
        </form>
      </details>
    </>}
  </article>;
}

export function SocialFeed({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPostId = searchParams.get("post");
  const [feed, setFeed] = useState([]);
  const [connections, setConnections] = useState([]);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState("professional");
  const [portfolioId, setPortfolioId] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingPost, setEditingPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const requestId = useRef(0);
  const userId = user.id;
  const accountType = user.accountType;

  useEffect(() => {
    if (!selectedImage) {
      const frame = window.requestAnimationFrame(() => setPreviewUrl(""));
      return () => window.cancelAnimationFrame(frame);
    }
    const url = URL.createObjectURL(selectedImage);
    const frame = window.requestAnimationFrame(() => setPreviewUrl(url));
    return () => { window.cancelAnimationFrame(frame); URL.revokeObjectURL(url); };
  }, [selectedImage]);

  const loadFeed = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const [postsResult, connectionsResult, portfolioResult, mutesResult] = await Promise.all([
        supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(40),
        supabase.from("connections").select("id, requester_id, recipient_id, status")
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        accountType === "Freelancer"
          ? supabase.from("portfolio_items").select("id, title").eq("freelancer_id", userId).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("muted_users").select("muted_user_id").eq("user_id", userId)
      ]);
      if (portfolioResult.error) throw portfolioResult.error;
      const missingPosts = ["PGRST205", "42P01"].includes(postsResult.error?.code);
      const missingConnections = ["PGRST205", "42P01"].includes(connectionsResult.error?.code);
      const missingMutes = ["PGRST205", "42P01"].includes(mutesResult.error?.code);
      if (postsResult.error && !missingPosts) throw postsResult.error;
      if (connectionsResult.error && !missingConnections) throw connectionsResult.error;
      if (mutesResult.error && !missingMutes) throw mutesResult.error;
      const posts = missingPosts ? [] : postsResult.data || [];
      const postIds = posts.map((item) => item.id);
      const profileIds = [...new Set([
        ...posts.map((item) => item.author_id),
        ...(connectionsResult.data || []).flatMap((item) => [item.requester_id, item.recipient_id]),
        userId
      ])];
      const [likesResult, commentsResult, freelancerProfiles, clientProfiles] = await Promise.all([
        postIds.length && !missingPosts ? supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
        postIds.length && !missingPosts ? supabase.from("post_comments").select("id, post_id, author_id, body, created_at, updated_at")
          .in("post_id", postIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
        supabase.from("freelancer_public_profiles").select("*").in("id", profileIds),
        supabase.from("client_public_profiles").select("*").in("id", profileIds)
      ]);
      for (const result of [likesResult, commentsResult, freelancerProfiles, clientProfiles]) {
        if (result.error) throw result.error;
      }
      const profiles = Object.fromEntries([...(freelancerProfiles.data || []), ...(clientProfiles.data || [])].map((profile) => [profile.id, profile]));
      const items = buildSocialFeed(posts, profiles, (mutesResult.data || []).map((item) => item.muted_user_id));
      const enriched = mapPostEngagement(items, likesResult.data || [], commentsResult.data || [], profiles, userId);
      if (request !== requestId.current) return;
      setFeed(enriched);
      setConnections(connectionsResult.data || []);
      setPortfolioItems(portfolioResult.data || []);
      setError(missingPosts || missingConnections
        ? "Social features are waiting for the reviewed staging migration. Existing job discovery remains available."
        : "");
    } catch (loadError) {
      if (request !== requestId.current) return;
      const missingSocialSchema = ["PGRST205", "42P01"].includes(loadError?.code);
      setError(missingSocialSchema
        ? "Social marketplace data is waiting for its reviewed staging migration. Jobs and applications remain available."
        : getRequestErrorMessage("Unable to load your professional feed", loadError));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [accountType, userId]);

  useEffect(() => {
    const timer = window.setTimeout(loadFeed, 0);
    return () => { window.clearTimeout(timer); requestId.current += 1; };
  }, [loadFeed]);

  useEffect(() => {
    const interval = window.setInterval(loadFeed, 30000);
    const channel = supabase.channel(`social-feed-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, loadFeed)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, loadFeed)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, loadFeed)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, loadFeed)
      .subscribe();
    return () => { window.clearInterval(interval); supabase.removeChannel(channel); };
  }, [loadFeed, userId]);

  useEffect(() => {
    if (!requestedPostId || !feed.some((item) => item.id === requestedPostId)) return;
    document.getElementById(`social-post-${requestedPostId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [feed, requestedPostId]);

  const isFreelancer = accountType === "Freelancer";
  const sortedFeed = useMemo(() => feed, [feed]);

  function clearComposer() {
    setBody(""); setPostType("professional"); setPortfolioId(""); setSelectedImage(null); setEditingPost(null);
  }

  function editPost(item) {
    setEditingPost(item); setBody(item.body || ""); setPostType(item.post_type || "professional");
    setPortfolioId(item.portfolio_item_id || ""); setSelectedImage(null); setError("");
    document.getElementById("social-post-body")?.focus();
  }

  async function uploadImage(file) {
    if (!isValidMarketplaceImage(file)) throw new Error("Choose a JPEG, PNG, or WebP image up to 5 MiB.");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const result = await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type
    });
    if (result.error) throw result.error;
    return path;
  }

  async function savePost(event) {
    event.preventDefault();
    if (!body.trim() && !selectedImage && !editingPost?.image_path) { setError("Add a message or an image before publishing."); return; }
    setSaving(true); setError(""); setNotice("");
    let uploadedPath = "";
    const oldImagePath = editingPost?.image_path || "";
    try {
      if (selectedImage) uploadedPath = await uploadImage(selectedImage);
      const payload = {
        body: body.trim(), post_type: isFreelancer ? postType : "professional",
        portfolio_item_id: isFreelancer && postType === "service" ? portfolioId || null : null,
        image_path: uploadedPath || oldImagePath || null,
        updated_at: new Date().toISOString()
      };
      const result = editingPost
        ? await supabase.from("posts").update(payload).eq("id", editingPost.id).eq("author_id", userId).select("id").single()
        : await supabase.from("posts").insert({ ...payload, author_id: userId }).select("id").single();
      if (result.error) throw result.error;
      if (uploadedPath && oldImagePath) await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).remove([oldImagePath]);
      clearComposer(); setNotice(editingPost ? "Your post was updated." : "Your professional post is live."); await loadFeed();
    } catch (saveError) {
      if (uploadedPath) await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).remove([uploadedPath]);
      setError(getRequestErrorMessage("Unable to publish this post", saveError));
    } finally { setSaving(false); }
  }

  async function toggleLike(item) {
    setBusyId(item.id); setError("");
    try {
      const result = item.likedByMe
        ? await supabase.from("post_likes").delete().eq("post_id", item.id).eq("user_id", userId)
        : await supabase.from("post_likes").insert({ post_id: item.id, user_id: userId });
      if (result.error) throw result.error;
      await loadFeed();
    } catch (actionError) { setError(getRequestErrorMessage("Unable to update your reaction", actionError)); }
    finally { setBusyId(""); }
  }

  async function addComment(postId, commentBody) {
    setBusyId(postId); setError("");
    try {
      const result = await supabase.from("post_comments").insert({ post_id: postId, author_id: userId, body: commentBody });
      if (result.error) throw result.error;
      await loadFeed(); return true;
    } catch (actionError) { setError(getRequestErrorMessage("Unable to add your comment", actionError)); return false; }
    finally { setBusyId(""); }
  }

  async function editComment(commentId, postId, commentBody) {
    setBusyId(postId); setError("");
    try {
      const result = await supabase.from("post_comments").update({ body: commentBody.trim(), updated_at: new Date().toISOString() })
        .eq("id", commentId).eq("author_id", userId).select("id").single();
      if (result.error) throw result.error;
      await loadFeed(); return true;
    } catch (actionError) { setError(getRequestErrorMessage("Unable to update your comment", actionError)); return false; }
    finally { setBusyId(""); }
  }

  async function deleteComment(commentId, postId) {
    if (!window.confirm("Delete your comment?")) return;
    setBusyId(postId); setError("");
    try {
      const result = await supabase.from("post_comments").delete().eq("id", commentId).eq("author_id", userId);
      if (result.error) throw result.error;
      await loadFeed();
    } catch (actionError) { setError(getRequestErrorMessage("Unable to delete your comment", actionError)); }
    finally { setBusyId(""); }
  }

  async function deletePost(item) {
    if (!window.confirm("Delete this professional post and its comments?")) return;
    setBusyId(item.id); setError("");
    try {
      const result = await supabase.from("posts").delete().eq("id", item.id).eq("author_id", userId);
      if (result.error) throw result.error;
      if (item.image_path) await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).remove([item.image_path]);
      await loadFeed(); setNotice("Your post was deleted.");
    } catch (actionError) { setError(getRequestErrorMessage("Unable to delete this post", actionError)); }
    finally { setBusyId(""); }
  }

  async function connectOrMessage(item) {
    const otherId = item.author_id || item.client_id;
    if (!otherId || otherId === userId) return;
    setBusyId(item.id); setError(""); setNotice("");
    try {
      let connection = getConnectionForPair(connections, userId, otherId);
      if (!connection) {
        const created = await supabase.from("connections").insert({ requester_id: userId, recipient_id: otherId })
          .select("id, requester_id, recipient_id, status").single();
        if (created.error) throw created.error;
        connection = created.data;
        setConnections((current) => [...current, connection]);
        setNotice("Connection request sent. Messaging opens after the other member accepts.");
        return;
      }
      if (connection.status === "Declined") { setNotice("This connection request was declined."); return; }
      if (connection.status === "Pending") {
        if (connection.requester_id === userId) { setNotice("Your connection request is waiting for a response."); return; }
        const accepted = await supabase.from("connections").update({ status: "Accepted" })
          .eq("id", connection.id).eq("recipient_id", userId).eq("status", "Pending")
          .select("id, requester_id, recipient_id, status").single();
        if (accepted.error) throw accepted.error;
        connection = accepted.data;
        setConnections((current) => current.map((item) => item.id === connection.id ? connection : item));
      }
      const thread = await supabase.from("conversations").select("id")
        .eq("application_id", `connection:${connection.id}`).maybeSingle();
      if (thread.error) throw thread.error;
      if (!thread.data) throw new Error("The accepted connection conversation is not available yet.");
      navigate(`/messages?conversation=${encodeURIComponent(thread.data.id)}&sharePost=${encodeURIComponent(item.id)}`);
    } catch (actionError) { setError(getRequestErrorMessage("Unable to connect with this member", actionError)); }
    finally { setBusyId(""); }
  }

  async function sharePost(item) {
    const url = postPath(item.id);
    try {
      await navigator.clipboard.writeText(url);
      setShareUrl("");
      setNotice("A shareable link to this post was copied.");
    } catch {
      setShareUrl(url);
      setNotice("Copying was blocked. Select and copy this share link:");
    }
  }

  return <section className="social-feed" aria-labelledby="social-feed-heading">
    <header className="social-feed-heading"><div><span className="dashboard-tag">TECHKARVO COMMUNITY</span><h2 id="social-feed-heading">Daily Feed</h2><p>Professional updates, work samples, and services from your community.</p></div>
      <div className="social-feed-links"><Link to="/social">Open feed</Link><Link to="/jobs">Job Feed</Link><Link to="/connections">Connections</Link></div>
    </header>

    <form className="social-composer" onSubmit={savePost}>
      <div className="social-composer-top"><strong>{editingPost ? "Edit your post" : "Share a professional update"}</strong><span>Visible to signed-in TechKarvo members</span></div>
      {notice && <p className="social-feed-notice" role="status">{notice}</p>}
      {shareUrl && <p className="social-share-fallback"><a href={shareUrl}>{shareUrl}</a></p>}
      <label className="visually-hidden" htmlFor="social-post-body">Post text</label>
      <textarea id="social-post-body" maxLength={5000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share an update, insight, or service…" />
      {previewUrl && <img className="social-composer-preview" src={previewUrl} alt="Selected image preview" />}
      {!previewUrl && editingPost?.image_path && <img className="social-composer-preview" src={imageUrl(editingPost.image_path)} alt="Current post image" />}
      <div className="social-composer-controls">
        <div className="social-composer-fields">
          {isFreelancer && <label><span>Post type</span><select value={postType} onChange={(event) => setPostType(event.target.value)}><option value="professional">Professional update</option><option value="service">Service showcase</option></select></label>}
          {isFreelancer && postType === "service" && portfolioItems.length > 0 && <label><span>Link portfolio project (optional)</span><select value={portfolioId} onChange={(event) => setPortfolioId(event.target.value)}><option value="">No project selected</option>{portfolioItems.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
          <label className="social-image-picker"><span>{editingPost ? "Replace image" : "Add image"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setSelectedImage(event.target.files?.[0] || null)} /></label>
        </div>
        <div className="social-composer-actions">{editingPost && <button type="button" className="social-cancel-button" disabled={saving} onClick={clearComposer}>Cancel</button>}<button type="submit" disabled={saving}>{saving ? "Publishing…" : editingPost ? "Save changes" : "Publish"}</button></div>
      </div>
      <small>Images must be JPEG, PNG, or WebP and no larger than 5 MiB.</small>
    </form>

    {error && feed.length > 0 && <div className="social-feed-error social-feed-error--retry" role="alert"><span>{error}</span><button type="button" disabled={loading} onClick={() => { setLoading(true); loadFeed(); }}>Retry</button></div>}
    {loading ? <div className="social-feed-state" role="status"><span className="applicant-spinner" aria-hidden="true" /><h3>Loading your feed…</h3></div>
        : error && feed.length === 0 ? <div className="social-feed-state"><h3>Feed setup is pending</h3><p>{error}</p><button type="button" disabled={loading} onClick={() => { setLoading(true); loadFeed(); }}>Try again</button></div>
        : sortedFeed.length === 0 ? <div className="social-feed-state"><h3>Your feed is ready for its first update</h3><p>Share a professional post, or check back when people in your community publish updates.</p></div>
          : <div className="social-feed-list">{sortedFeed.map((item) => <SocialPost
            key={`${item.feedType}-${item.id}`} item={item} user={user}
            connection={item.feedType === "post" ? getConnectionForPair(connections, userId, item.author_id) : null}
            busy={busyId === item.id}
            onLike={toggleLike} onComment={addComment} onCommentEdit={editComment} onCommentDelete={deleteComment}
            onEdit={editPost} onDelete={deletePost} onConnect={connectOrMessage} onShare={sharePost}
          />)}</div>}
  </section>;
}

export function SocialPage({ user: suppliedUser }) {
  const { user: authUser } = useAuth();
  const user = resolveSocialPageUser(suppliedUser, authUser);
  if (!user?.id || !user.accountType) return <div className="dashboard-page"><main className="dashboard-container"><p role="status">Loading your community feed…</p></main></div>;
  return <div className="dashboard-page"><DashboardNav user={user} /><main className="dashboard-container"><SocialFeed user={user} /></main></div>;
}
