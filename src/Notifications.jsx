import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";

function getNotificationLink(item) {
  if (item.data?.conversation_id) return `/messages?conversation=${encodeURIComponent(item.data.conversation_id)}`;
  if (item.data?.application_id) {
    return item.kind === "application_received" ? "/job-applicants" : "/my-applications";
  }
  return "/";
}

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [savingAll, setSavingAll] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await supabase.from("notifications").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (!active) return;
      if (result.error) setError("Unable to load notifications. " + result.error.message);
      else setItems(result.data || []);
      setLoading(false);
    }
    load().catch((loadError) => {
      if (!active) return;
      setError("Unable to load notifications. " + loadError.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user.id]);

  async function markRead(id) {
    if (savingId || savingAll) return;
    setSavingId(id);
    setError("");
    try {
      const result = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", user.id).select("id, read_at").single();
      if (result.error) {
        console.error("Notification update failed:", result.error.message);
        setError("Unable to update notification. Please try again.");
        return;
      }
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: result.data.read_at } : item));
    } catch (updateError) {
      console.error("Notification update failed:", updateError);
      setError("A network error interrupted the notification update.");
    } finally {
      setSavingId("");
    }
  }

  async function markAllRead() {
    if (savingAll || savingId) return;
    setSavingAll(true);
    setError("");
    try {
      const result = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id).is("read_at", null).select("id, read_at");
      if (result.error) {
        console.error("Mark all notifications read failed:", result.error.message);
        setError("Unable to mark notifications read. Please try again.");
        return;
      }
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    } catch (updateError) {
      console.error("Mark all notifications read failed:", updateError);
      setError("A network error interrupted the notification update.");
    } finally {
      setSavingAll(false);
    }
  }

  const unreadCount = items.filter((item) => !item.read_at).length;
  const dashboard = user.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard";

  return (
    <div className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to={dashboard} className="dashboard-logo">TechKarvo</Link>
        <Link to={dashboard} className="dashboard-logout">Back to Dashboard</Link>
      </header>
      <main className="dashboard-container">
        <div className="dashboard-welcome">
          <span className="dashboard-tag">ACCOUNT UPDATES</span>
          <h1>Notifications</h1>
          <p>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You’re all caught up."}</p>
          {unreadCount > 0 && <button type="button" className="secondary-btn" disabled={savingAll || Boolean(savingId)} onClick={markAllRead}>{savingAll ? "Updating…" : "Mark all as read"}</button>}
        </div>
        {error && <p role="alert">{error}</p>}
        <section className="dashboard-section notification-list">
          {loading ? <div className="no-jobs"><h3>Loading notifications…</h3></div> : items.length === 0 ? (
            <div className="no-jobs"><h3>No notifications yet</h3><p>Project and application updates will appear here.</p></div>
          ) : items.map((item) => (
            <article className={"notification-card " + (item.read_at ? "read" : "unread")} key={item.id}>
              <span className="notification-dot" aria-hidden="true" />
              <div className="notification-copy">
                <h2>{item.title}</h2>
                <p>{item.body}</p>
                <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
              </div>
              <div className="notification-actions">
                <Link to={getNotificationLink(item)} onClick={() => !item.read_at && markRead(item.id)}>Open</Link>
                {!item.read_at && <button type="button" disabled={savingAll || Boolean(savingId)} onClick={() => markRead(item.id)}>{savingId === item.id ? "Updating…" : "Mark read"}</button>}
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

export default Notifications;
