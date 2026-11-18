import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import DashboardNav from "./DashboardNav.jsx";
import { countUnreadMessagesByConversation } from "./marketplace.js";
import { MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";
import { toSafeExternalUrl } from "./external-urls.js";
import "./Messages.css";

function sharedImageUrl(path) {
  if (!path) return "";
  return toSafeExternalUrl(supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(path).data?.publicUrl) || "";
}

function Messages() {
  const { user } = useAuth();
  const accountType = user.accountType;
  const [searchParams] = useSearchParams();
  const requestedApplicationId = searchParams.get("application");
  const requestedConversationId = searchParams.get("conversation");
  const requestedSharePostId = searchParams.get("sharePost");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sharePostDraft, setSharePostDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const selectedConversation = useMemo(() => conversations.find((item) => item.id === selectedId), [conversations, selectedId]);

  useEffect(() => {
    if (!requestedSharePostId) return undefined;
    let active = true;
    supabase.from("posts").select("id, author_id, post_type, body, image_path")
      .eq("id", requestedSharePostId).maybeSingle().then(async ({ data, error: postError }) => {
        if (postError) throw postError;
        if (!data || !active) return;
        const [freelancer, client] = await Promise.all([
          supabase.from("freelancer_public_profiles").select("id, full_name").eq("id", data.author_id).maybeSingle(),
          supabase.from("client_public_profiles").select("id, full_name").eq("id", data.author_id).maybeSingle()
        ]);
        if (!active) return;
        setSharePostDraft({ ...data, authorName: freelancer.data?.full_name || client.data?.full_name || "TechKarvo member" });
      }).catch((shareError) => {
        if (active) {
          console.error("Shared post preview could not be loaded:", shareError);
          setError("This post preview is no longer available.");
        }
      });
    return () => { active = false; };
  }, [requestedSharePostId]);

  useEffect(() => {
    let active = true;

    async function loadConversations() {
      if (!user?.id) return;

      let requestedId = "";
      if (requestedApplicationId) {
        const applicationResult = await supabase.from("job_applications")
          .select("id, job_id, client_id, freelancer_id, status")
          .eq("id", requestedApplicationId).maybeSingle();

        if (applicationResult.error) throw applicationResult.error;
        const application = applicationResult.data;
        if (!application || !["Pending", "Accepted"].includes(application.status)
          || ![application.client_id, application.freelancer_id].includes(user.id)) {
          throw new Error("This application is not available for messaging.");
        }

        const existing = await supabase.from("conversations").select("id")
          .eq("application_id", String(application.id)).maybeSingle();
        if (existing.error) throw existing.error;

        if (existing.data) {
          requestedId = existing.data.id;
        } else {
          const created = await supabase.from("conversations").insert({
            application_id: String(application.id),
            job_id: String(application.job_id),
            client_id: application.client_id,
            freelancer_id: application.freelancer_id,
            created_by: user.id
          }).select("id").single();

          if (created.error?.code === "23505") {
            const retry = await supabase.from("conversations").select("id")
              .eq("application_id", String(application.id)).single();
            if (retry.error) throw retry.error;
            requestedId = retry.data.id;
          } else if (created.error) {
            throw created.error;
          } else {
            requestedId = created.data.id;
          }
        }
      }

      const result = await supabase.from("conversations").select("*")
        .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;

      const rows = result.data || [];
      const applicationRows = rows.filter((item) => !item.application_id.startsWith("connection:"));
      const directRows = rows.filter((item) => item.application_id.startsWith("connection:"));
      const applicationIds = applicationRows.map((item) => item.application_id);
      const connectionIds = directRows.map((item) => item.application_id.slice("connection:".length));
      const conversationIds = rows.map((item) => item.id);
      let unreadByConversation = {};
      if (conversationIds.length) {
        const unreadResult = await supabase.from("messages").select("conversation_id")
          .in("conversation_id", conversationIds).neq("sender_id", user.id).is("read_at", null);
        if (unreadResult.error) throw unreadResult.error;
        unreadByConversation = countUnreadMessagesByConversation(unreadResult.data || []);
      }
      let applicationsById = {};
      if (applicationIds.length) {
        const applicationsResult = await supabase.from("job_applications")
          .select("id, full_name, professional_title, status")
          .in("id", applicationIds);
        if (applicationsResult.error) throw applicationsResult.error;
        applicationsById = Object.fromEntries((applicationsResult.data || []).map((item) => [String(item.id), item]));
      }

      let connectionsById = {};
      if (connectionIds.length) {
        const connectionsResult = await supabase.from("connections")
          .select("id, requester_id, recipient_id, status").in("id", connectionIds).eq("status", "Accepted");
        if (connectionsResult.error) throw connectionsResult.error;
        connectionsById = Object.fromEntries((connectionsResult.data || []).map((item) => [item.id, item]));
      }

      const directMemberIds = [...new Set(directRows.flatMap((item) => [item.client_id, item.freelancer_id]))];
      let directProfilesById = {};
      if (directMemberIds.length) {
        const [freelancers, clients] = await Promise.all([
          supabase.from("freelancer_public_profiles").select("*").in("id", directMemberIds),
          supabase.from("client_public_profiles").select("*").in("id", directMemberIds)
        ]);
        if (freelancers.error) throw freelancers.error;
        if (clients.error) throw clients.error;
        directProfilesById = Object.fromEntries([...(freelancers.data || []), ...(clients.data || [])].map((item) => [item.id, item]));
      }

      const jobIds = [...new Set(rows.filter((item) => !item.job_id.startsWith("connection:")).map((item) => item.job_id))];
      let jobsById = {};
      if (jobIds.length) {
        const jobsResult = await supabase.from("jobs").select("id, title").in("id", jobIds);
        if (!jobsResult.error) jobsById = Object.fromEntries((jobsResult.data || []).map((item) => [String(item.id), item.title]));
      }

      if (!active) return;
      const formatted = rows.map((item) => {
        const application = applicationsById[String(item.application_id)];
        const isDirect = item.application_id.startsWith("connection:");
        const connectionId = isDirect ? item.application_id.slice("connection:".length) : "";
        const otherId = item.client_id === user.id ? item.freelancer_id : item.client_id;
        const otherProfile = directProfilesById[otherId];
        const otherName = isDirect ? otherProfile?.full_name || "TechKarvo member"
          : item.client_id === user.id ? application?.full_name || "Freelancer" : "Client";
        return {
          ...item,
          otherName,
          otherTitle: isDirect ? otherProfile?.professional_title || otherProfile?.country || "Marketplace member" : application?.professional_title || "Marketplace member",
          jobTitle: isDirect ? "TechKarvo connection" : jobsById[String(item.job_id)] || "Project conversation",
          messagingOpen: isDirect ? connectionsById[connectionId]?.status === "Accepted" : ["Pending", "Accepted"].includes(application?.status),
          unreadCount: unreadByConversation[item.id] || 0
        };
      });
      setConversations(formatted);
      const requestedThread = requestedConversationId && formatted.some((item) => item.id === requestedConversationId)
        ? requestedConversationId
        : "";
      const initialId = requestedId || requestedThread || formatted[0]?.id || "";
      setSelectedId(initialId);
      setLoading(false);
      setError("");
    }

    loadConversations().catch((loadError) => {
      if (!active) return;
      console.error("Conversation loading failed:", loadError);
      setError(loadError.message === "This application is not available for messaging."
        ? loadError.message
        : "Unable to load conversations. Please try again.");
      setLoading(false);
    });

    return () => { active = false; };
  }, [user.id, accountType, requestedApplicationId, requestedConversationId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    let loadInProgress = false;
    let conversationNotificationsMarkedRead = false;

    async function loadMessages() {
      if (loadInProgress) return;
      loadInProgress = true;

      try {
        const result = await supabase.from("messages").select("*")
          .eq("conversation_id", selectedId)
          .order("created_at", { ascending: true });
        if (result.error) throw result.error;
        if (!active) return;

        let conversationMessages = result.data || [];
        const sharedPostIds = [...new Set(conversationMessages.map((item) => item.shared_post_id).filter(Boolean))];
        if (sharedPostIds.length) {
          const postsResult = await supabase.from("posts").select("id, author_id, post_type, body, image_path")
            .in("id", sharedPostIds);
          if (!postsResult.error) {
            const authorIds = [...new Set((postsResult.data || []).map((item) => item.author_id))];
            const [freelancers, clients] = await Promise.all([
              supabase.from("freelancer_public_profiles").select("id, full_name").in("id", authorIds),
              supabase.from("client_public_profiles").select("id, full_name").in("id", authorIds)
            ]);
            const authors = Object.fromEntries([...(freelancers.data || []), ...(clients.data || [])].map((item) => [item.id, item.full_name]));
            const postsById = Object.fromEntries((postsResult.data || []).map((item) => [item.id, { ...item, authorName: authors[item.author_id] || "TechKarvo member" }]));
            conversationMessages = conversationMessages.map((item) => ({ ...item, sharedPost: postsById[item.shared_post_id] || null }));
          }
        }
        setMessages(conversationMessages);
        const unreadIds = conversationMessages
          .filter((item) => item.sender_id !== user.id && !item.read_at)
          .map((item) => item.id);
        if (unreadIds.length) {
          const readResult = await supabase.from("messages").update({ read_at: new Date().toISOString() })
            .in("id", unreadIds);
          if (readResult.error) console.error("Message read receipt update failed:", readResult.error.message);
          else setConversations((current) => current.map((item) => item.id === selectedId ? { ...item, unreadCount: 0 } : item));
        }

        if (!conversationNotificationsMarkedRead) {
          const notificationsResult = await supabase.from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .eq("kind", "new_message")
            .is("read_at", null)
            .contains("data", { conversation_id: selectedId });
          if (notificationsResult.error) {
            console.error("Message notification read update failed:", notificationsResult.error.message);
          } else {
            conversationNotificationsMarkedRead = true;
          }
        }
      } finally {
        loadInProgress = false;
      }
    }

    loadMessages().catch((loadError) => {
      if (!active) return;
      console.error("Message loading failed:", loadError);
      setError("Unable to load messages for this conversation. Please try again.");
    });
    const refresh = window.setInterval(() => {
      loadMessages().catch((loadError) => {
        if (!active) return;
        console.error("Message refresh failed:", loadError);
        setError("Unable to refresh messages. Please try again.");
      });
    }, 12000);
    const channel = supabase.channel(`messages-${selectedId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedId}` }, () => {
        loadMessages().catch((loadError) => {
          if (active) setError("Unable to refresh messages. Please try again.");
          console.error("Real-time message refresh failed:", loadError);
        });
      })
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(refresh);
      supabase.removeChannel(channel);
    };
  }, [selectedId, user?.id]);

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim() || (sharePostDraft ? "Shared a TechKarvo post" : "");
    if (!body || !selectedId) return;

    setSending(true);
    setError("");
    try {
      const result = await supabase.from("messages").insert({
        conversation_id: selectedId,
        sender_id: user.id,
        body,
        shared_post_id: sharePostDraft?.id || null
      });
      if (result.error) {
        console.error("Message send failed:", result.error.message);
        setError("Message could not be sent. Please try again.");
        return;
      }

      setDraft("");
      setSharePostDraft(null);
      const refreshed = await supabase.from("messages").select("*")
        .eq("conversation_id", selectedId).order("created_at", { ascending: true });
      if (refreshed.error) {
        console.error("Message refresh failed:", refreshed.error.message);
        setError("Your message was sent, but the conversation could not be refreshed.");
      } else {
        setMessages(refreshed.data || []);
      }
    } catch (sendError) {
      console.error("Message send failed:", sendError);
      setError("A network error interrupted sending. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="dashboard-page messages-page">
      <DashboardNav user={user} />

      <div className="messages-shell">
        <section className="messages-list-panel" aria-label="Conversations">
          <div className="messages-panel-heading">
            <span className="dashboard-tag">YOUR WORKSPACE</span>
            <h1>Messages</h1>
            <p>Keep every project conversation in one place.</p>
          </div>
          {loading ? <p className="messages-empty">Loading conversations…</p> : conversations.length === 0 ? (
            <div className="messages-empty">
              <strong>No conversations yet</strong>
              <span>Open a conversation from an application or applicant profile.</span>
            </div>
          ) : (
            <div className="conversation-list">
              {conversations.map((item) => (
                <button key={item.id} type="button" className={"conversation-item " + (selectedId === item.id ? "selected" : "")} onClick={() => setSelectedId(item.id)}>
                  <span className="conversation-avatar">{item.otherName.charAt(0).toUpperCase()}</span>
                  <span className="conversation-copy"><strong>{item.otherName}</strong><small>{item.jobTitle}</small></span>
                  {item.unreadCount > 0 && <span className="conversation-unread" aria-label={`${item.unreadCount} unread messages`}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="messages-thread-panel" aria-label="Message thread">
          {selectedConversation ? (
            <>
              <div className="thread-heading">
                <div><span>{selectedConversation.jobTitle}</span><h2>{selectedConversation.otherName}</h2></div>
                <small>{selectedConversation.otherTitle}</small>
              </div>
              <div className="thread-messages" aria-live="polite">
                {messages.length === 0 ? <p className="messages-empty">Start the conversation with a short introduction.</p> : messages.map((item) => (
                  <article key={item.id} className={"message-bubble " + (item.sender_id === user.id ? "mine" : "theirs")}>
                    {item.sharedPost && <article className="message-shared-post">
                      <span>Shared professional post</span><strong>{item.sharedPost.authorName}</strong>
                      {item.sharedPost.image_path && sharedImageUrl(item.sharedPost.image_path) && <img src={sharedImageUrl(item.sharedPost.image_path)} alt="Shared post image" loading="lazy" />}
                      {item.sharedPost.body && <p>{item.sharedPost.body}</p>}
                      <Link to={`/social?post=${encodeURIComponent(item.sharedPost.id)}`}>View post</Link>
                    </article>}
                    <p>{item.body}</p>
                    <span className="message-meta"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>{item.sender_id === user.id && item.read_at && <span className="message-seen" aria-label="Seen">Seen</span>}</span>
                  </article>
                ))}
              </div>
              {selectedConversation.messagingOpen ? (
                <form className="message-composer" onSubmit={sendMessage}>
                  {sharePostDraft && <div className="message-share-draft" role="status">
                    <span>Post ready to share · {sharePostDraft.authorName}</span>
                    {sharePostDraft.image_path && sharedImageUrl(sharePostDraft.image_path) && <img src={sharedImageUrl(sharePostDraft.image_path)} alt="Selected post preview" />}
                    {sharePostDraft.body && <p>{sharePostDraft.body}</p>}
                    <button type="button" onClick={() => setSharePostDraft(null)}>Remove post preview</button>
                  </div>}
                  <label className="visually-hidden" htmlFor="message-body">Write a message</label>
                  <textarea id="message-body" maxLength={10000} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={sharePostDraft ? "Add a note (optional)…" : "Write a message…"} />
                  <button type="submit" className="primary-btn" disabled={sending || (!draft.trim() && !sharePostDraft)}>{sending ? "Sending…" : sharePostDraft ? "Share in conversation" : "Send"}</button>
                </form>
              ) : (
                <p className="messages-closed-note" role="status">This application is closed. You can read the conversation, but new messages are disabled.</p>
              )}
            </>
          ) : (
            <div className="messages-thread-empty"><span>✉</span><h2>Select a conversation</h2><p>Choose a thread to read and reply to messages.</p></div>
          )}
          {error && <p className="messages-error" role="alert">{error}</p>}
        </section>
      </div>
    </main>
  );
}

export default Messages;
