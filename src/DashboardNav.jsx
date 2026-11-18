import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { logoutUser } from "./auth.js";

function notificationTarget(item) {
  if (item.data?.conversation_id) return `/messages?conversation=${encodeURIComponent(item.data.conversation_id)}`;
  if (item.data?.application_id) {
    return ["application_received", "application_withdrawn"].includes(item.kind)
      ? "/job-applicants"
      : "/my-applications";
  }
  return "/notifications";
}

function Badge({ count }) {
  if (!count) return null;
  return <span className="nav-count" aria-hidden="true">{count > 99 ? "99+" : count}</span>;
}

export default function DashboardNav({ user, title = "Dashboard" }) {
  const navigate = useNavigate();
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const menuRef = useRef(null);
  const userId = user.id;
  const dashboardPath = user?.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard";

  const refreshCounts = useCallback(async () => {
    if (!userId) return;
    const [notifications, messages, latest] = await Promise.all([
      supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", userId).is("read_at", null),
      supabase.from("messages").select("id", { count: "exact", head: true })
        .neq("sender_id", userId).is("read_at", null),
      supabase.from("notifications").select("id, kind, title, body, data, created_at, read_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(5)
    ]);
    if (notifications.error) console.error("Unread notification count unavailable:", notifications.error.message);
    else setNotificationCount(notifications.count || 0);
    if (messages.error) console.error("Unread message count unavailable:", messages.error.message);
    else setMessageCount(messages.count || 0);
    if (latest.error) console.error("Recent notifications unavailable:", latest.error.message);
    else setRecent(latest.data || []);
  }, [userId]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshCounts, 0);
    const channel = supabase.channel(`dashboard-alerts-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, refreshCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refreshCounts)
      .subscribe();
    // Polling is a fallback for projects where Supabase Realtime is not enabled.
    const interval = window.setInterval(refreshCounts, 30000);
    const onVisibility = () => { if (document.visibilityState === "visible") refreshCounts(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initialRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [userId, refreshCounts]);

  useEffect(() => {
    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleLogout() {
    setLogoutError("");
    const result = await logoutUser();
    if (result.error) {
      setLogoutError("Unable to log out. Please try again.");
      return;
    }
    navigate("/login");
  }

  async function openNotification(item) {
    setMenuOpen(false);
    if (!item.read_at) {
      const result = await supabase.from("notifications")
        .update({ read_at: new Date().toISOString() }).eq("id", item.id).eq("user_id", userId).select("id").maybeSingle();
      if (result.error) console.error("Notification read update failed:", result.error.message);
      else refreshCounts();
    }
    navigate(notificationTarget(item));
  }

  return (
    <>
      <header className="dashboard-navbar">
        <Link to={dashboardPath} className="dashboard-logo" aria-label="TechKarvo home">Tech<span>Karvo</span></Link>
        <nav className="dashboard-nav-links" aria-label="Workspace navigation">
          <Link to={dashboardPath} aria-current="page">{title}</Link>
          <Link to="/jobs">Find work</Link>
          <Link to="/messages">Messages</Link>
        </nav>
        <div className="dashboard-nav-actions">
          <Link className="dashboard-icon-link" to="/messages" aria-label={`Messages, ${messageCount} unread`}>
            <span aria-hidden="true">✉</span><Badge count={messageCount} />
          </Link>
          <div className="notification-menu" ref={menuRef}>
            <button className="dashboard-icon-link" type="button" aria-label={`Notifications, ${notificationCount} unread`}
              aria-expanded={menuOpen} aria-controls="notification-preview" onClick={() => setMenuOpen((open) => !open)}>
              <span aria-hidden="true">♢</span><Badge count={notificationCount} />
            </button>
            {menuOpen && <section className="notification-preview" id="notification-preview" aria-label="Recent notifications">
              <div className="notification-preview-heading"><strong>Notifications</strong><Link to="/notifications" onClick={() => setMenuOpen(false)}>View all</Link></div>
              {recent.length ? recent.map((item) => (
                <button type="button" key={item.id} className={`notification-preview-item ${item.read_at ? "" : "unread"}`} onClick={() => openNotification(item)}>
                  <strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                </button>
              )) : <p className="notification-preview-empty">You’re all caught up.</p>}
            </section>}
          </div>
          <button type="button" onClick={handleLogout} className="dashboard-logout">Log out</button>
        </div>
      </header>
      {logoutError && <p className="dashboard-nav-error" role="alert">{logoutError}</p>}
    </>
  );
}
