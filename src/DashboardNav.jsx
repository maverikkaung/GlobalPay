import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { logoutUser } from "./auth.js";
import { useTheme } from "./useTheme.js";
import { getProfilePath, getQuickActions } from "./dashboard-navigation.js";

function Icon({ name }) {
  const paths = {
    messages: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" /><path d="M7.5 10h6M7.5 13h4" /></>,
    notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function notificationTarget(item) {
  if (item.data?.conversation_id) return `/messages?conversation=${encodeURIComponent(item.data.conversation_id)}`;
  if (item.data?.connection_id) return `/connections?request=${encodeURIComponent(item.data.connection_id)}`;
  if (item.data?.post_id) return `/social?post=${encodeURIComponent(item.data.post_id)}`;
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

export default function DashboardNav({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [activeMenu, setActiveMenu] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const navRef = useRef(null);
  const userId = user.id;
  const dashboardPath = user.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard";
  const isDashboard = ["/client-dashboard", "/freelancer-dashboard"].includes(location.pathname);
  const myProfilePath = getProfilePath(user.accountType);

  const refreshCounts = useCallback(async () => {
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
      if (!navRef.current?.contains(event.target)) setActiveMenu("");
    }
    function handleEscape(event) {
      if (event.key === "Escape") {
        const trigger = navRef.current?.querySelector('[data-menu-trigger][aria-expanded="true"]');
        setActiveMenu("");
        trigger?.focus();
      }
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
      setActiveMenu("");
      return;
    }
    navigate("/login");
  }

  async function openNotification(item) {
    setActiveMenu("");
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
      <header className="dashboard-navbar" ref={navRef}>
        <Link to={dashboardPath} className="dashboard-logo" aria-label="TechKarvo dashboard">Tech<span>Karvo</span></Link>
        {!isDashboard && <Link className="dashboard-back-link" to={dashboardPath} aria-label="Back to dashboard">← <span>Back</span></Link>}
        <div className="dashboard-nav-actions">
          <Link className="dashboard-icon-link" to="/messages" aria-label={`Messages, ${messageCount} unread`} title="Messages">
            <Icon name="messages" /><Badge count={messageCount} />
          </Link>
          <div className="nav-popover-anchor">
            <button className="dashboard-icon-link" type="button" aria-label={`Notifications, ${notificationCount} unread`} title="Notifications"
              data-menu-trigger
              aria-expanded={activeMenu === "notifications"} aria-controls="notification-preview"
              onClick={() => setActiveMenu((open) => open === "notifications" ? "" : "notifications")}>
              <Icon name="notifications" /><Badge count={notificationCount} />
            </button>
            {activeMenu === "notifications" && <section className="notification-preview" id="notification-preview" aria-label="Recent notifications">
              <div className="notification-preview-heading"><strong>Notifications</strong><Link to="/notifications" onClick={() => setActiveMenu("")}>View all</Link></div>
              {recent.length ? recent.map((item) => (
                <button type="button" key={item.id} className={`notification-preview-item ${item.read_at ? "" : "unread"}`} onClick={() => openNotification(item)}>
                  <strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                </button>
              )) : <p className="notification-preview-empty">You’re all caught up.</p>}
            </section>}
          </div>
          <div className="nav-popover-anchor">
            <button className="dashboard-icon-link profile-icon-button" type="button" aria-label="Profile menu" title="Profile"
              data-menu-trigger
              aria-expanded={activeMenu === "profile"} aria-controls="profile-menu"
              onClick={() => setActiveMenu((open) => open === "profile" ? "" : "profile")}>
              <span className="profile-avatar-fallback" aria-hidden="true"><Icon name="profile" /></span>
            </button>
            {activeMenu === "profile" && <section className="nav-dropdown profile-dropdown" id="profile-menu" aria-label="Profile options">
              <div className="profile-dropdown-heading"><strong>{user.name || "TechKarvo member"}</strong><span>{user.accountType}</span></div>
              {myProfilePath && <Link to={myProfilePath} onClick={() => setActiveMenu("")}>My Profile</Link>}
              <Link to="/account-settings" onClick={() => setActiveMenu("")}>Account Settings</Link>
              <button type="button" className="theme-toggle-row" role="switch" aria-checked={theme === "dark"} onClick={toggleTheme}>
                <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
                <span className="theme-switch-track" aria-hidden="true"><span /></span>
              </button>
              <button type="button" className="profile-logout" onClick={handleLogout}>Log Out</button>
            </section>}
          </div>
          <div className="nav-popover-anchor quick-actions-anchor">
            <button className="dashboard-icon-link quick-actions-trigger" type="button" aria-label="Quick actions" title="Quick actions"
              data-menu-trigger
              aria-expanded={activeMenu === "quick"} aria-controls="quick-actions-menu"
              onClick={() => setActiveMenu((open) => open === "quick" ? "" : "quick")}>
              <Icon name="menu" />
            </button>
            {activeMenu === "quick" && <nav className="nav-dropdown quick-actions-menu" id="quick-actions-menu" aria-label={`${user.accountType} quick actions`}>
              <strong>Quick actions</strong>
              {getQuickActions(user.accountType).map(([label, path]) => (
                <Link key={path} to={path} onClick={() => setActiveMenu("")}>{label}</Link>
              ))}
            </nav>}
          </div>
        </div>
      </header>
      {logoutError && <p className="dashboard-nav-error" role="alert">{logoutError}</p>}
    </>
  );
}
