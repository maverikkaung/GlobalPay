import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth.js";
import { supabase } from "./supabase.js";
import { getRequestErrorMessage } from "./request-errors.js";
import { toSafeExternalUrl } from "./external-urls.js";
import { MARKETPLACE_MEDIA_BUCKET } from "./social-marketplace.js";
import { profileMediaPath } from "./profile-preview.js";
import DashboardNav from "./DashboardNav.jsx";

const CONNECTION_PROFILE_FIELDS = "id,full_name,professional_title,country,avatar_path";

function avatarFor(profile) {
  const path = profileMediaPath(profile?.avatar_path, profile?.id);
  return path ? toSafeExternalUrl(supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(path).data?.publicUrl) : "";
}

function Connections() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("request");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await supabase.from("connections").select("id, requester_id, recipient_id, status, created_at")
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`).order("created_at", { ascending: false });
      if (result.error) throw result.error;
      const rows = result.data || [];
      const memberIds = [...new Set(rows.flatMap((item) => [item.requester_id, item.recipient_id]))];
      const [freelancers, clients] = await Promise.all([
        memberIds.length ? supabase.from("freelancer_public_profiles").select(CONNECTION_PROFILE_FIELDS).in("id", memberIds) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? supabase.from("client_public_profiles").select(CONNECTION_PROFILE_FIELDS).in("id", memberIds) : Promise.resolve({ data: [], error: null })
      ]);
      if (freelancers.error) throw freelancers.error;
      if (clients.error) throw clients.error;
      const profiles = Object.fromEntries([...(freelancers.data || []), ...(clients.data || [])].map((item) => [item.id, item]));
      setItems(rows.map((item) => ({
        ...item,
        incoming: item.recipient_id === user.id,
        member: profiles[item.requester_id === user.id ? item.recipient_id : item.requester_id]
      })));
    } catch (loadError) {
      setError(getRequestErrorMessage("Unable to load your connections", loadError));
    } finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { const timer = window.setTimeout(loadConnections, 0); return () => window.clearTimeout(timer); }, [loadConnections]);

  async function respond(item, status) {
    if (status === "Declined" && !window.confirm("Decline this connection request?")) return;
    setBusyId(item.id); setError(""); setNotice("");
    try {
      const result = await supabase.from("connections").update({ status })
        .eq("id", item.id).eq("recipient_id", user.id).eq("status", "Pending")
        .select("id, requester_id, recipient_id, status").single();
      if (result.error) throw result.error;
      if (status === "Accepted") {
        const thread = await supabase.from("conversations").select("id")
          .eq("application_id", `connection:${item.id}`).single();
        if (thread.error) throw thread.error;
        navigate(`/messages?conversation=${encodeURIComponent(thread.data.id)}`);
        return;
      }
      setNotice("Connection request declined.");
      await loadConnections();
    } catch (actionError) { setError(getRequestErrorMessage("Unable to update this connection", actionError)); }
    finally { setBusyId(""); }
  }

  async function openConversation(item) {
    setBusyId(item.id); setError("");
    try {
      const result = await supabase.from("conversations").select("id")
        .eq("application_id", `connection:${item.id}`).single();
      if (result.error) throw result.error;
      navigate(`/messages?conversation=${encodeURIComponent(result.data.id)}`);
    } catch (actionError) { setError(getRequestErrorMessage("Unable to open this conversation", actionError)); }
    finally { setBusyId(""); }
  }

  if (!user) return null;
  const focused = requestedId ? items.filter((item) => item.id === requestedId) : items;
  const incoming = focused.filter((item) => item.status === "Pending" && item.incoming);
  const outgoing = focused.filter((item) => item.status === "Pending" && !item.incoming);
  const accepted = focused.filter((item) => item.status === "Accepted");
  const declined = focused.filter((item) => item.status === "Declined");
  const cards = (rows, heading, emptyText) => <section className="connection-section"><h2>{heading}<span>{rows.length}</span></h2>
    {rows.length === 0 ? <p className="connection-empty-copy">{emptyText}</p> : <div className="connection-list">{rows.map((item) => <article className="connection-card" key={item.id}>
      {avatarFor(item.member)
        ? <img className="connection-avatar" src={avatarFor(item.member)} alt="" loading="lazy" />
        : <div className="connection-avatar" aria-hidden="true">{(item.member?.full_name || "T").charAt(0).toUpperCase()}</div>}
      <div className="connection-member"><Link to={item.member?.id ? `/profiles/${item.member.id}` : "/social"}>{item.member?.full_name || "TechKarvo member"}</Link>
        <p>{item.member?.professional_title || item.member?.country || "Marketplace member"}</p>
        <span>{item.member?.country || ""}</span>
      </div>
      <span className={`connection-status connection-status--${item.status.toLowerCase()}`}>{item.status}</span>
      <div className="connection-actions">
        {item.status === "Pending" && item.incoming ? <><button type="button" className="social-primary-button" disabled={busyId === item.id} onClick={() => respond(item, "Accepted")}>{busyId === item.id ? "Opening…" : "Accept"}</button><button type="button" className="social-outline-button" disabled={Boolean(busyId)} onClick={() => respond(item, "Declined")}>Decline</button></> : null}
        {item.status === "Pending" && !item.incoming && <span>Waiting for a response</span>}
        {item.status === "Accepted" && <button type="button" className="social-primary-button" disabled={Boolean(busyId)} onClick={() => openConversation(item)}>Message</button>}
        {item.status === "Declined" && <span>No conversation was opened</span>}
      </div>
    </article>)}</div>}
  </section>;

  return <div className="dashboard-page"><DashboardNav user={user} /><main className="dashboard-container connections-page">
    <header className="dashboard-welcome"><span className="dashboard-tag">YOUR COMMUNITY</span><h1>Connections</h1><p>Messaging opens only after both members agree to connect.</p><Link to="/social">Back to professional feed</Link></header>
    {error && <div role="alert" className="connection-error"><p>{error}</p><button type="button" disabled={loading} onClick={loadConnections}>Try again</button></div>}
    {notice && <p role="status" className="social-feed-notice">{notice}</p>}
    {loading ? <div className="applicant-state" role="status"><h2>Loading connections…</h2></div> : items.length === 0
      ? <div className="applicant-state"><h2>No connection requests yet</h2><p>Connect with a member from a professional post or public profile.</p><Link to="/social">Explore the feed</Link></div>
      : <>{cards(incoming, "Needs your response", "No incoming requests.")}{cards(outgoing, "Sent requests", "No pending requests sent.")}{cards(accepted, "Connected", "Accepted connections will appear here.")}{cards(declined, "Declined", "No declined requests.")}</>}
  </main></div>;
}

export default Connections;
