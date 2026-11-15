import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import "./Messages.css";

function Messages() {
  const { user } = useAuth();
  const accountType = user.accountType;
  const [searchParams] = useSearchParams();
  const requestedApplicationId = searchParams.get("application");
  const requestedConversationId = searchParams.get("conversation");
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const selectedConversation = useMemo(() => conversations.find((item) => item.id === selectedId), [conversations, selectedId]);

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
      const applicationIds = rows.map((item) => item.application_id);
      let applicationsById = {};
      if (applicationIds.length) {
        const applicationsResult = await supabase.from("job_applications")
          .select("id, full_name, professional_title")
          .in("id", applicationIds);
        if (applicationsResult.error) throw applicationsResult.error;
        applicationsById = Object.fromEntries((applicationsResult.data || []).map((item) => [String(item.id), item]));
      }

      let clientProfilesById = {};
      if (accountType === "Freelancer") {
        const clientIds = [...new Set(rows.map((item) => item.client_id))];
        if (clientIds.length) {
          const profilesResult = await supabase.from("client_public_profiles")
            .select("id, full_name").in("id", clientIds);
          if (!profilesResult.error) {
            clientProfilesById = Object.fromEntries((profilesResult.data || []).map((item) => [item.id, item.full_name]));
          }
        }
      }

      const jobIds = [...new Set(rows.map((item) => item.job_id))];
      let jobsById = {};
      if (jobIds.length) {
        const jobsResult = await supabase.from("jobs").select("id, title").in("id", jobIds);
        if (!jobsResult.error) jobsById = Object.fromEntries((jobsResult.data || []).map((item) => [String(item.id), item.title]));
      }

      if (!active) return;
      const formatted = rows.map((item) => {
        const application = applicationsById[String(item.application_id)];
        const otherName = item.client_id === user.id
          ? application?.full_name || "Freelancer"
          : clientProfilesById[item.client_id] || "Client";
        return {
          ...item,
          otherName,
          otherTitle: application?.professional_title || "Marketplace member",
          jobTitle: jobsById[String(item.job_id)] || "Project conversation"
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
      setError(loadError.message || "Unable to load conversations.");
      setLoading(false);
    });

    return () => { active = false; };
  }, [user.id, accountType, requestedApplicationId, requestedConversationId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;

    async function loadMessages() {
      const result = await supabase.from("messages").select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      if (result.error) throw result.error;
      if (!active) return;

      setMessages(result.data || []);
      const unreadIds = (result.data || []).filter((item) => item.sender_id !== user.id && !item.read_at).map((item) => item.id);
      if (unreadIds.length) {
        await supabase.from("messages").update({ read_at: new Date().toISOString() })
          .in("id", unreadIds);
      }
    }

    loadMessages().catch((loadError) => {
      if (active) setError(loadError.message || "Unable to load messages.");
    });
    const refresh = window.setInterval(() => {
      loadMessages().catch((loadError) => {
        if (active) setError(loadError.message || "Unable to refresh messages.");
      });
    }, 12000);

    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [selectedId, user?.id]);

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedId) return;

    setSending(true);
    setError("");
    const result = await supabase.from("messages").insert({
      conversation_id: selectedId,
      sender_id: user.id,
      body
    });
    setSending(false);
    if (result.error) {
      setError("Message could not be sent. " + result.error.message);
      return;
    }

    setDraft("");
    const refreshed = await supabase.from("messages").select("*")
      .eq("conversation_id", selectedId).order("created_at", { ascending: true });
    if (refreshed.error) setError("Your message was sent, but the conversation could not be refreshed.");
    else setMessages(refreshed.data || []);
  }

  return (
    <main className="dashboard-page messages-page">
      <header className="dashboard-navbar">
        <Link to={user?.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard"} className="dashboard-logo">TechKarvo</Link>
        <Link to={user?.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard"} className="dashboard-logout">Back to Dashboard</Link>
      </header>

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
                    <p>{item.body}</p>
                    <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                  </article>
                ))}
              </div>
              <form className="message-composer" onSubmit={sendMessage}>
                <label className="visually-hidden" htmlFor="message-body">Write a message</label>
                <textarea id="message-body" maxLength={10000} rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" required />
                <button type="submit" className="primary-btn" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button>
              </form>
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
