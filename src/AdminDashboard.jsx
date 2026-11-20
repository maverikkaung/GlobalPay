import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useAuth } from "./useAuth.js";
import DashboardNav from "./DashboardNav.jsx";

const sections = ["Overview", "Support", "Moderation", "Membership catalog", "Financial sandbox", "Product settings", "Audit log"];

function summarizeError(result) {
  if (!result?.error) return "";
  if (result.error.code === "PGRST202" || /function .* does not exist/i.test(result.error.message || "")) {
    return "Admin tools are not configured in this database yet.";
  }
  return "The Admin Dashboard could not load this data. Check the database configuration and try again.";
}

function AdminDashboard() {
  const { user } = useAuth();
  const [section, setSection] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [setupUnavailable, setSetupUnavailable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState({ summary: {}, support: [], reports: [], tiers: [], settings: [], audit: [], financialPlans: [], financialDisputes: [], financialSummary: {} });
  const [reportDrafts, setReportDrafts] = useState({});
  const [settingKey, setSettingKey] = useState("brand.name");
  const [settingValue, setSettingValue] = useState('"TechKarvo"');
  const [isPublicSetting, setIsPublicSetting] = useState(true);
  const [tierDrafts, setTierDrafts] = useState({});
  const [financialPlanDrafts, setFinancialPlanDrafts] = useState({});
  const [financialConfig, setFinancialConfig] = useState(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");
    setSetupUnavailable(false);
    const check = await supabase.rpc("techkarvo_is_platform_admin");
    if (check.error) {
      setSetupUnavailable(true);
      setError(summarizeError(check));
      setAuthorized(false);
      setLoading(false);
      return;
    }
    if (check.data !== true) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    setAuthorized(true);
    const [summary, support, reports, tiers, settings, audit, financialPlans, financialDisputes, financialSummary, financialConfigResult] = await Promise.all([
      supabase.rpc("techkarvo_admin_marketplace_summary"),
      supabase.from("support_cases").select("id, requester_id, subject, description, category, status, priority, assigned_admin_id, created_at, updated_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("user_reports").select("id, reporter_id, reported_user_id, category, details, status, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("membership_tiers").select("slug, display_name, description, features, simulation_price_usdt, is_active, display_order, updated_at").order("display_order"),
      supabase.from("platform_settings").select("setting_key, setting_value, is_public, updated_at").order("setting_key").limit(100),
      supabase.from("admin_audit_log").select("id, actor_id, action, resource_type, resource_id, details, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("membership_plans").select("id, account_type, slug, display_name, description, included_usage_credits, simulated_price_usdt, fee_bps, features, entitlements, is_active, display_order").order("account_type").order("display_order"),
      supabase.from("financial_disputes").select("id, milestone_id, opened_by, reason, status, resolution_note, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.rpc("techkarvo_admin_financial_summary"),
      supabase.rpc("techkarvo_admin_financial_configuration")
    ]);
    const failed = [summary, support, reports, tiers, settings, audit].find((item) => item.error);
    if (failed) setError(summarizeError(failed));
    setData({
      summary: summary.data?.[0] || {},
      support: support.data || [],
      reports: reports.data || [],
      tiers: tiers.data || [],
      settings: settings.data || [],
      audit: audit.data || [],
      financialPlans: financialPlans.data || [],
      financialDisputes: financialDisputes.data || [],
      financialSummary: financialSummary.data || {}
    });
    if (financialConfigResult.data?.simulation_only) setFinancialConfig(financialConfigResult.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadAdminData, 0);
    return () => window.clearTimeout(timer);
  }, [loadAdminData, revision]);

  async function runAction(action, successMessage) {
    setError("");
    setNotice("");
    const result = await action();
    if (result.error) {
      setError(summarizeError(result));
      return false;
    }
    setNotice(successMessage);
    setRevision((current) => current + 1);
    return true;
  }

  function updateSupport(caseItem, form) {
    const formData = new FormData(form);
    return runAction(() => supabase.rpc("techkarvo_admin_update_support_case", {
      p_case_id: caseItem.id,
      p_status: String(formData.get("status")),
      p_priority: String(formData.get("priority")),
      p_assigned_admin_id: formData.get("assigned_admin_id") || null
    }), "Support case updated and recorded in the audit log.");
  }

  function reviewReport(report, form) {
    const formData = new FormData(form);
    return runAction(() => supabase.rpc("techkarvo_admin_review_report", {
      p_report_id: report.id,
      p_status: String(formData.get("status")),
      p_note: String(formData.get("note") || "").trim()
    }), "Moderation decision saved to the audit log.");
  }

  function saveTier(tier) {
    const draft = tierDrafts[tier.slug] || tier;
    let features;
    try { features = JSON.parse(typeof draft.features === "string" ? draft.features : JSON.stringify(draft.features)); }
    catch { setError(`The ${tier.display_name} features must be valid JSON.`); return; }
    if (!Array.isArray(features)) { setError("Membership features must be a JSON list."); return; }
    const price = draft.simulation_price_usdt === "" || draft.simulation_price_usdt == null ? null : Number(draft.simulation_price_usdt);
    if (price != null && (!Number.isFinite(price) || price < 0)) { setError("Enter a valid non-negative sample USDT amount."); return; }
    runAction(() => supabase.rpc("techkarvo_admin_upsert_membership_tier", {
      p_slug: tier.slug,
      p_display_name: String(draft.display_name).trim(),
      p_description: String(draft.description || "").trim(),
      p_features: features,
      p_simulation_price_usdt: price,
      p_is_active: Boolean(draft.is_active),
      p_display_order: Number(draft.display_order)
    }), "Demo catalog entry saved. This does not create a paid plan.");
  }

  function saveSetting(event) {
    event.preventDefault();
    let value;
    try { value = JSON.parse(settingValue); }
    catch { setError("Enter a valid JSON value for this setting."); return; }
    runAction(() => supabase.rpc("techkarvo_admin_set_product_setting", {
      p_key: settingKey.trim(), p_value: value, p_is_public: isPublicSetting
    }), "Product setting saved and recorded in the audit log.");
  }

  function saveFinancialPlan(plan) {
    const draft = financialPlanDrafts[`${plan.account_type}:${plan.slug}`] || plan;
    let features, entitlements;
    try { features = JSON.parse(typeof draft.features === "string" ? draft.features : JSON.stringify(draft.features)); }
    catch { setError("Membership features must be valid JSON."); return; }
    try { entitlements = JSON.parse(typeof draft.entitlements === "string" ? draft.entitlements : JSON.stringify(draft.entitlements)); }
    catch { setError("Membership entitlements must be valid JSON."); return; }
    const price = Number(draft.simulated_price_usdt);
    if (!Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) { setError("Simulation membership prices must be nonnegative amounts with at most two decimals."); return; }
    if ((plan.slug === "free" && price !== 0) || (plan.slug !== "free" && price <= 0)) { setError("Free plans must be 0 KAV; paid plans must have a positive sample price."); return; }
    if (!Number.isInteger(Number(draft.fee_bps)) || Number(draft.fee_bps) < 0 || Number(draft.fee_bps) > 9999) { setError("Enter a fee rate from 0 to 99.99 percent."); return; }
    if (!Array.isArray(features) || features.length > 30 || features.some((feature) => typeof feature !== "string" || !feature.trim() || feature.length > 240)) { setError("Enter up to 30 non-empty benefit descriptions, each no longer than 240 characters."); return; }
    if (!entitlements || Array.isArray(entitlements) || Object.entries(entitlements).some(([key, value]) => !["profile_boost", "featured_jobs", "advanced_search", "analytics", "priority_support", "ad_rewards"].includes(key) || typeof value !== "boolean")) { setError("Use only supported boolean membership entitlements."); return; }
    runAction(() => supabase.rpc("techkarvo_admin_upsert_membership_plan", {
      p_account_type: plan.account_type, p_slug: plan.slug, p_display_name: String(draft.display_name).trim(),
      p_description: String(draft.description || "").trim(), p_credits: Number(draft.included_usage_credits),
      p_sample_price: price, p_fee_bps: Number(draft.fee_bps), p_features: features, p_entitlements: entitlements,
      p_active: Boolean(draft.is_active), p_display_order: Number(draft.display_order)
    }), "Simulation plan saved and recorded in the audit log.");
  }

  function saveFinancialConfig(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      p_sandbox_enabled: form.get("sandbox_enabled") === "on",
      p_ad_reward_kav: Number(form.get("ad_reward_kav")),
      p_ad_rewards_per_day: Number(form.get("ad_rewards_per_day")), p_max_deposit_usdt: Number(form.get("max_deposit_usdt")),
      p_max_withdrawal_kav: Number(form.get("max_withdrawal_kav"))
    };
    runAction(() => supabase.rpc("techkarvo_admin_update_financial_config", payload), "Sandbox configuration saved and recorded in the audit log.");
  }

  function resolveSandboxDispute(item, resolution) {
    const note = window.prompt(`Add an audit note for the simulated ${resolution} decision (5+ characters).`);
    if (!note || note.trim().length < 5) return;
    if (!window.confirm(`Confirm simulated ${resolution}? This never moves real funds.`)) return;
    runAction(() => supabase.rpc("techkarvo_sandbox_resolve_dispute", { p_dispute_id: item.id, p_resolution: resolution, p_note: note.trim() }), "Dispute simulation resolved and added to the audit log.");
  }

  if (loading) return <main className="route-loading" aria-live="polite">Verifying administrator access…</main>;
  if (setupUnavailable) return <main className="admin-setup-state"><DashboardNav user={user} /><section><span className="admin-eyebrow">OWNER TOOLS</span><h1>{error === "Admin tools are not configured in this database yet." ? "Admin tools are not enabled" : "Administrator access could not be checked"}</h1><p>{error || "The required admin database migration is not configured in this project."}</p>{error === "Admin tools are not configured in this database yet." ? <p>Have the project owner review and approve the admin/support migration before enabling this dashboard.</p> : <button className="admin-primary" type="button" onClick={() => setRevision((current) => current + 1)}>Try again</button>}</section></main>;
  if (!authorized) return <main className="admin-setup-state"><DashboardNav user={user} /><section><span className="admin-eyebrow">OWNER TOOLS</span><h1>Administrator access required</h1><p>This account has not been assigned trusted platform administrator access.</p><p>Administrators are provisioned through a buyer-controlled trusted database operation, never by changing a public profile role.</p></section></main>;

  return <main className="admin-dashboard-page">
    <DashboardNav user={user} />
    <div className="admin-dashboard-layout">
      <aside className="admin-sidebar"><span className="admin-eyebrow">OWNER CONSOLE</span><h1>Admin Dashboard</h1><p>Marketplace operations · {user?.name}</p>
        <nav aria-label="Admin sections">{sections.map((item) => <button type="button" key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>)}</nav>
      </aside>
      <section className="admin-main" aria-live="polite">
        <header className="admin-page-heading"><div><span className="admin-eyebrow">TECHKARVO OPERATIONS</span><h2>{section}</h2></div><button type="button" onClick={() => setRevision((current) => current + 1)}>Refresh</button></header>
        {error && <p className="admin-message error" role="alert">{error}</p>}
        {notice && <p className="admin-message success" role="status">{notice}</p>}

        {section === "Overview" && <>
          <div className="admin-stat-grid">{[["Clients", data.summary.total_clients], ["Freelancers", data.summary.total_freelancers], ["Open jobs", data.summary.open_jobs], ["Applications", data.summary.total_applications], ["Active contracts", data.summary.active_contracts], ["Completed contracts", data.summary.completed_contracts], ["Pending reports", data.summary.pending_reports], ["Open support cases", data.summary.open_support_cases]].map(([label, value]) => <article className="admin-card admin-stat" key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></article>)}</div>
          <article className="admin-card"><h3>Financial activity</h3><p>No real financial activity is collected. KAV/USDT figures exist only inside the isolated Demo Mode and are not included in admin or marketplace totals.</p></article>
        </>}

        {section === "Support" && <div className="admin-record-list">{data.support.map((item) => <article className="admin-card" key={item.id}><div className="admin-record-heading"><div><span className="admin-eyebrow">{item.category.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}</span><h3>{item.subject}</h3></div><time>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.description}</p><small>Requester reference: {item.requester_id.slice(0, 8)}</small><form onSubmit={(event) => { event.preventDefault(); updateSupport(item, event.currentTarget); }}><label>Status<select name="status" defaultValue={item.status}>{["open", "triaged", "waiting_on_user", "resolved", "closed"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><label>Priority<select name="priority" defaultValue={item.priority}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label><label>Assign admin UUID<input name="assigned_admin_id" defaultValue={item.assigned_admin_id || ""} placeholder="Leave blank to unassign" /></label><button className="admin-primary" type="submit">Save case update</button></form></article>)}{!data.support.length && <p className="admin-empty">No support cases yet.</p>}</div>}

        {section === "Moderation" && <div className="admin-record-list">{data.reports.map((item) => <article className="admin-card" key={item.id}><div className="admin-record-heading"><div><span className="admin-eyebrow">{item.category} · {item.status}</span><h3>Member report</h3></div><time>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.details || "No additional details provided."}</p><p className="admin-id-line">Reporter: {item.reporter_id.slice(0, 8)} · Reported member: {item.reported_user_id.slice(0, 8)}</p><form onSubmit={(event) => { event.preventDefault(); reviewReport(item, event.currentTarget); }}><label>Decision<select name="status" defaultValue={item.status === "pending" ? "reviewing" : item.status}>{["reviewing", "resolved", "dismissed"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label>Private moderator note<textarea name="note" maxLength={2000} rows={3} value={reportDrafts[item.id] || ""} onChange={(event) => setReportDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button className="admin-primary" type="submit">Save moderation decision</button></form></article>)}{!data.reports.length && <p className="admin-empty">No member reports yet.</p>}</div>}

        {section === "Membership catalog" && <div className="admin-record-list">{data.tiers.map((tier) => { const draft = tierDrafts[tier.slug] || tier; return <article className="admin-card" key={tier.slug}><div className="admin-record-heading"><div><span className="admin-eyebrow">SIMULATION ONLY · {tier.slug}</span><h3>{tier.display_name}</h3></div><span>{tier.is_active ? "Visible in catalog" : "Disabled"}</span></div><div className="admin-form-grid"><label>Display name<input value={draft.display_name} maxLength={60} onChange={(event) => setTierDrafts((current) => ({ ...current, [tier.slug]: { ...draft, display_name: event.target.value } }))} /></label><label>Sample price (USDT)<input type="number" min="0" step="0.01" value={draft.simulation_price_usdt ?? ""} onChange={(event) => setTierDrafts((current) => ({ ...current, [tier.slug]: { ...draft, simulation_price_usdt: event.target.value } }))} placeholder="Not configured" /></label><label className="admin-wide">Description<input value={draft.description} maxLength={500} onChange={(event) => setTierDrafts((current) => ({ ...current, [tier.slug]: { ...draft, description: event.target.value } }))} /></label><label>Display order<input type="number" min="0" max="1000" value={draft.display_order} onChange={(event) => setTierDrafts((current) => ({ ...current, [tier.slug]: { ...draft, display_order: Number(event.target.value) } }))} /></label><label className="admin-checkbox"><input type="checkbox" checked={Boolean(draft.is_active)} onChange={(event) => setTierDrafts((current) => ({ ...current, [tier.slug]: { ...draft, is_active: event.target.checked } }))} />Show sample catalog entry</label><label className="admin-wide">Features as JSON list<textarea rows={3} value={typeof draft.features === "string" ? draft.features : JSON.stringify(draft.features, null, 2)} onChange={(event) => setTierDrafts((current) => ({ ...current, [tier.slug]: { ...draft, features: event.target.value } }))} /></label></div><button className="admin-primary" type="button" onClick={() => saveTier(tier)}>Save simulation-only tier</button></article>; })}</div>}

        {section === "Financial sandbox" && <div className="admin-record-list">
          <article className="admin-card"><h3>Financial simulation activity</h3><p>No real payments, funds, withdrawals, or advertisement network are enabled.</p><div className="admin-stat-grid">{[["Simulated entries", data.financialSummary.simulated_transaction_count], ["Simulated gross KAV", data.financialSummary.simulated_gross_kav], ["Open disputes", data.financialSummary.open_disputes], ["Held KAV (simulation)", data.financialSummary.outstanding_held_kav]].map(([label, value]) => <div className="financial-admin-stat" key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></div>)}</div></article>
          <article className="admin-card"><h3>Client and Freelancer simulation plans</h3><p>Prices and benefits are simulation-only. Role fee is charged only in the milestone ledger. Monthly renewal requires each member's explicit consent.</p>{data.financialPlans.map((plan) => { const key = `${plan.account_type}:${plan.slug}`; const draft = financialPlanDrafts[key] || plan; return <div className="financial-admin-plan" key={key}><strong>{plan.account_type} · {plan.slug}</strong><div className="admin-form-grid"><label>Display name<input value={draft.display_name} maxLength={60} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, display_name: event.target.value } }))} /></label><label>Monthly usage credits<input type="number" min="0" max="100000" value={draft.included_usage_credits} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, included_usage_credits: Number(event.target.value) } }))} /></label><label>Monthly sample KAV price<input type="number" min="0" step="0.01" value={draft.simulated_price_usdt} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, simulated_price_usdt: event.target.value } }))} /></label><label>{plan.account_type === "client" ? "Client service fee (%)" : "Freelancer commission (%)"}<input type="number" min="0" max="99.99" step="0.01" value={(Number(draft.fee_bps || 0) / 100).toFixed(2)} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, fee_bps: Math.round(Number(event.target.value) * 100) } }))} /></label><label>Description<input value={draft.description} maxLength={500} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, description: event.target.value } }))} /></label><label className="admin-wide">Benefits (JSON list)<textarea rows={3} value={typeof draft.features === "string" ? draft.features : JSON.stringify(draft.features, null, 2)} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, features: event.target.value } }))} /></label><label className="admin-wide">Enforced benefit entitlements (JSON object)<textarea rows={3} value={typeof draft.entitlements === "string" ? draft.entitlements : JSON.stringify(draft.entitlements || {}, null, 2)} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, entitlements: event.target.value } }))} /></label><label className="admin-checkbox"><input type="checkbox" checked={Boolean(draft.is_active)} disabled={plan.slug === "free"} onChange={(event) => setFinancialPlanDrafts((current) => ({ ...current, [key]: { ...draft, is_active: event.target.checked } }))} />Available for simulation</label></div><button className="admin-primary" type="button" onClick={() => saveFinancialPlan(plan)}>Save role plan</button></div>; })}{!data.financialPlans.length && <p>The financial simulation migration is not installed in this database yet.</p>}</article>
          {financialConfig && <article className="admin-card"><h3>Sandbox rules</h3><p>These controls apply only to the simulated ledger. Per-plan fees are configured above. There are no provider keys or real-money toggles.</p><form onSubmit={saveFinancialConfig}><label className="admin-checkbox"><input type="checkbox" name="sandbox_enabled" defaultChecked={financialConfig.sandbox_enabled} />Enable test workflows</label><label>Reward KAV per claim<input name="ad_reward_kav" type="number" min="0.01" max="1000" step="0.01" defaultValue={financialConfig.ad_reward_kav} /></label><label>Daily sample reward limit<input name="ad_rewards_per_day" type="number" min="0" max="100" defaultValue={financialConfig.ad_rewards_per_day} /></label><label>Max sample deposit USDT<input name="max_deposit_usdt" type="number" min="0.01" max="1000000" step="0.01" defaultValue={financialConfig.max_deposit_usdt} /></label><label>Max sample withdrawal KAV<input name="max_withdrawal_kav" type="number" min="0.01" max="1000000" step="0.01" defaultValue={financialConfig.max_withdrawal_kav} /></label><button className="admin-primary" type="submit">Save simulation settings</button></form></article>}
          <article className="admin-card"><h3>Simulated disputes</h3>{data.financialDisputes.filter((item) => item.status === "open").map((item) => <div className="financial-admin-dispute" key={item.id}><span>{item.reason}</span><time>{new Date(item.created_at).toLocaleString()}</time><div><button className="admin-primary" type="button" onClick={() => resolveSandboxDispute(item,"release")}>Resolve as sample release</button><button className="admin-primary" type="button" onClick={() => resolveSandboxDispute(item,"refund")}>Resolve as sample refund</button></div></div>)}{!data.financialDisputes.some((item) => item.status === "open") && <p>No open financial sandbox disputes.</p>}</article>
        </div>}

        {section === "Product settings" && <article className="admin-card"><h3>Buyer-owned product configuration</h3><p>Only store non-secret presentation values here. Supabase keys, passwords, payment credentials, and private provider settings do not belong in product settings.</p><form onSubmit={saveSetting}><label>Setting key<input value={settingKey} onChange={(event) => setSettingKey(event.target.value)} pattern="[a-z][a-z0-9_.-]{1,79}" required /></label><label>JSON value<textarea rows={5} value={settingValue} onChange={(event) => setSettingValue(event.target.value)} required /></label><label className="admin-checkbox"><input type="checkbox" checked={isPublicSetting} onChange={(event) => setIsPublicSetting(event.target.checked)} />Members may read this setting</label><button className="admin-primary" type="submit">Save product setting</button></form><h3>Existing settings</h3>{data.settings.map((item) => <div className="admin-audit-row" key={item.setting_key}><strong>{item.setting_key}</strong><code>{JSON.stringify(item.setting_value)}</code><span>{item.is_public ? "Public" : "Admin only"}</span></div>)}</article>}

        {section === "Audit log" && <div className="admin-record-list">{data.audit.map((item) => <article className="admin-card admin-audit-row" key={item.id}><div><span className="admin-eyebrow">{item.resource_type} · {item.resource_id}</span><h3>{item.action}</h3><time>{new Date(item.created_at).toLocaleString()}</time></div><code>{JSON.stringify(item.details)}</code></article>)}{!data.audit.length && <p className="admin-empty">No administrative actions recorded yet.</p>}</div>}
      </section>
    </div>
  </main>;
}

export default AdminDashboard;
