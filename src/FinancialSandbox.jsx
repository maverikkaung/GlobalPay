import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardNav from "./DashboardNav.jsx";
import { supabase } from "./supabase.js";
import { useAuth } from "./useAuth.js";

const money = (value) => `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KAV`;

export default function FinancialSandbox() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [plans, setPlans] = useState([]);
  const [entitlement, setEntitlement] = useState(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [profileBoostUntil, setProfileBoostUntil] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [amount, setAmount] = useState("25");

  const refresh = useCallback(async () => {
    setError("");
    const [walletResult, planResult, entitlementResult, profileResult, contractsResult] = await Promise.all([
      supabase.rpc("techkarvo_sandbox_wallet"),
      supabase.from("membership_plans").select("id, account_type, slug, display_name, description, included_usage_credits, simulated_price_usdt, fee_bps, features, entitlements, is_active").eq("account_type", user?.accountType?.toLowerCase()).eq("is_active", true).order("display_order"),
      supabase.from("membership_entitlements").select("plan_id, period_started_at, period_ends_at, period_credit_limit, credits_used, auto_renew").eq("user_id", user?.id).maybeSingle(),
      supabase.from("profiles").select("profile_boost_until").eq("id", user?.id).maybeSingle(),
      supabase.from("contracts").select("id, job_id, client_id, freelancer_id, status").in("status", ["active", "disputed"]).order("created_at", { ascending: false }).limit(50)
    ]);
    const failure = [walletResult, planResult, entitlementResult, contractsResult].find((item) => item.error);
    if (failure) {
      setError("Financial sandbox is not available in this database yet. The reviewed staging migration must be applied before these account features are enabled.");
      return;
    }
    setWallet(walletResult.data);
    setPlans(planResult.data || []);
    setEntitlement(entitlementResult.data);
    setAutoRenew(Boolean(entitlementResult.data?.auto_renew));
    setProfileBoostUntil(profileResult.data?.profile_boost_until || null);
    setContracts(contractsResult.data || []);
    const contractIds = (contractsResult.data || []).map((item) => item.id);
    if (contractIds.length) {
      const milestoneResult = await supabase.from("contract_milestones").select("id, contract_id, title, amount_kav, status, created_at").in("contract_id", contractIds).order("created_at", { ascending: false });
      if (milestoneResult.error) { setError("Milestone sandbox is not available. Review the required database setup before using contracts here."); return; }
      setMilestones(milestoneResult.data || []);
    } else setMilestones([]);
  }, [user?.accountType, user?.id]);

  useEffect(() => { const timer = window.setTimeout(refresh, 0); return () => window.clearTimeout(timer); }, [refresh]);

  async function run(operation, success) {
    setBusy(true); setError(""); setNotice("");
    const result = await operation();
    setBusy(false);
    if (result.error) {
      const message = result.error.message || "";
      setError(message.includes("No usage credits") ? message
        : message.includes("Insufficient simulated KAV balance") ? "Your simulated KAV balance is too low for this action. Add sample KAV or choose the Free plan."
          : message.includes("eligible membership") ? "This feature requires an active eligible membership."
            : "The simulated action could not be completed. Check the sandbox configuration and try again.");
      return;
    }
    setNotice(success);
    await refresh();
  }

  function transfer(kind) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0.01 || Math.round(value * 100) !== value * 100) { setError("Enter a positive amount with at most two decimal places."); return; }
    const key = `${kind}:${user.id}:${crypto.randomUUID()}`;
    const call = kind === "deposit"
      ? supabase.rpc("techkarvo_sandbox_deposit", { p_usdt: value, p_idempotency_key: key })
      : supabase.rpc("techkarvo_sandbox_withdraw", { p_amount_kav: value, p_idempotency_key: key });
    run(() => call, kind === "deposit" ? "Simulated USDT credit recorded. No funds moved." : "Simulated withdrawal recorded. No payout occurred.");
  }

  function addMilestone(contractId, form) {
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const value = Number(formData.get("amount"));
    if (title.length < 3 || !Number.isFinite(value) || value < 0.01 || Math.round(value * 100) !== value * 100) { setError("Enter a milestone title and a positive KAV amount with at most two decimals."); return; }
    run(() => supabase.rpc("techkarvo_sandbox_create_milestone", { p_contract_id: contractId, p_title: title, p_amount_kav: value, p_idempotency_key: `milestone:${user.id}:${crypto.randomUUID()}` }), "Simulated milestone created. It does not secure funds.");
    form.reset();
  }

  function milestoneAction(id, action) {
    const reason = action === "dispute" ? window.prompt("Describe the issue (at least 10 characters). This is a staging simulation.") : "";
    if (action === "dispute" && (!reason || reason.trim().length < 10)) return;
    if (["release", "refund"].includes(action) && !window.confirm(`Confirm simulated ${action}? No real funds move.`)) return;
    run(() => action === "fund"
      ? supabase.rpc("techkarvo_sandbox_fund_milestone", { p_milestone_id: id })
      : supabase.rpc("techkarvo_sandbox_milestone_action", { p_milestone_id: id, p_action: action, p_reason: reason }),
    `Simulated milestone ${action} recorded. No real funds moved.`);
  }

  async function toggleProfileBoost(enabled) {
    setBusy(true); setError(""); setNotice("");
    const result = await supabase.rpc("techkarvo_set_profile_boost", { p_enabled: enabled });
    setBusy(false);
    if (result.error) { setError("Profile boost requires an active eligible membership."); return; }
    setProfileBoostUntil(result.data?.profile_boost_until || null);
    setNotice(enabled ? "Profile boost enabled for 30 days." : "Profile boost turned off.");
  }

  async function loadAnalytics() {
    setBusy(true); setError("");
    const result = await supabase.rpc("techkarvo_user_analytics");
    setBusy(false);
    if (result.error) { setError("Analytics require an active eligible membership."); return; }
    setAnalytics(result.data || {});
  }

  const activePlan = plans.find((plan) => plan.id === entitlement?.plan_id);
  const hasProfileBoost = activePlan?.entitlements?.profile_boost === true;
  const hasAnalytics = activePlan?.entitlements?.analytics === true;
  const hasAdRewards = activePlan?.entitlements?.ad_rewards === true;

  return <main className="financial-sandbox-page">
    <DashboardNav user={user} />
    <div className="financial-sandbox-wrap">
      <Link className="financial-back" to={user?.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard"}>← Dashboard</Link>
      <header className="financial-heading"><span className="admin-eyebrow">ACCOUNT TOOLS</span><h1>Membership &amp; KAV Sandbox</h1><p>Interactive simulation only. No real payments, deposits, escrow, withdrawals, or funds are enabled.</p></header>
      <div className="financial-simulation-banner" role="note"><strong>SIMULATED — NO FUNDS MOVED</strong><span>Reference only: 1 USDT = 1 KAV. This is not a market price or redemption promise.</span></div>
      {error && <p className="admin-message error" role="alert">{error}</p>}{notice && <p className="admin-message success" role="status">{notice}</p>}
      {!wallet && !error ? <p className="financial-loading" aria-live="polite">Loading sandbox…</p> : wallet && <>
        <section className="financial-wallet-card"><div><span>Available simulated balance</span><h2>{money(wallet.available_kav)}</h2><p>{money(wallet.held_kav)} held · {money(wallet.reward_kav)} non-withdrawable reward credits</p></div><div className="financial-transfer"><label htmlFor="sandbox-amount">Amount (KAV / USDT)</label><input id="sandbox-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /><div><button type="button" disabled={busy} onClick={() => transfer("deposit")}>Simulate USDT deposit</button><button type="button" className="secondary" disabled={busy} onClick={() => transfer("withdraw")}>Simulate withdrawal</button></div></div></section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">ROLE SPECIFIC</span><h2>{user?.accountType} membership</h2></div><p>Prices use the simulation reference rate 1 USDT = 1 KAV. Membership renewal is off unless you explicitly opt in.</p></header><div className="financial-plan-grid">{plans.map((plan) => { const current = entitlement?.plan_id === plan.id; return <article className="financial-plan-card" key={plan.id}><span className="financial-plan-label">SIMULATION PLAN</span><h3>{plan.display_name}</h3><p>{plan.description}</p><strong>{plan.included_usage_credits} {user?.accountType === "Client" ? "job posts" : "applications"} / month</strong><span>{money(plan.simulated_price_usdt)} / month · {user?.accountType === "Client" ? "service fee" : "freelancer commission"}: {(Number(plan.fee_bps || 0) / 100).toFixed(2)}%</span>{Array.isArray(plan.features) && plan.features.length > 0 && <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}<button type="button" disabled={busy || current} onClick={() => run(() => supabase.rpc("techkarvo_sandbox_activate_plan", { p_slug: plan.slug }), plan.slug === "free" ? "Free simulation plan selected." : "Simulated membership purchase recorded in KAV; no real payment was made.")}>{current ? "Current simulation plan" : plan.slug === "free" ? "Select Free plan" : "Purchase with simulated KAV"}</button></article>; })}</div>{entitlement && <><p className="financial-entitlement">Current month: {entitlement.credits_used} of {entitlement.period_credit_limit} used · ends {new Date(entitlement.period_ends_at).toLocaleDateString()}</p>{plans.find((plan) => plan.id === entitlement.plan_id)?.slug !== "free" && <label className="financial-renewal-toggle"><input type="checkbox" checked={autoRenew} disabled={busy} onChange={async (event) => { const value = event.target.checked; setBusy(true); setError(""); const result = await supabase.rpc("techkarvo_set_membership_auto_renew", { p_enabled: value }); setBusy(false); if (result.error) { setError("Renewal preference could not be saved. Please try again."); return; } setAutoRenew(value); setNotice(value ? "You opted in to simulated monthly renewal." : "Simulated monthly renewal was turned off."); }} /> I explicitly consent to simulated monthly renewal from my available KAV balance. I can turn this off at any time.</label>}</>}</section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">MEMBERSHIP BENEFITS</span><h2>Profile boost and analytics</h2></div><p>Benefits are verified against your active plan by the database.</p></header>{user?.accountType === "Freelancer" && <div className="financial-milestone-actions"><span>{profileBoostUntil && new Date(profileBoostUntil) > new Date() ? `Boost active until ${new Date(profileBoostUntil).toLocaleDateString()}` : hasProfileBoost ? "Profile boost is inactive" : "Profile boost requires Gold or Premium"}</span>{hasProfileBoost && <button type="button" disabled={busy} onClick={() => toggleProfileBoost(!(profileBoostUntil && new Date(profileBoostUntil) > new Date()))}>{profileBoostUntil && new Date(profileBoostUntil) > new Date() ? "Turn off profile boost" : "Enable profile boost"}</button>}</div>}<button type="button" disabled={busy || !hasAnalytics} onClick={loadAnalytics}>{hasAnalytics ? "Load membership analytics" : "Analytics require Gold or Premium"}</button>{analytics && <dl className="financial-analytics">{Object.entries(analytics).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl>}</section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">SIMULATION JOURNAL</span><h2>Recent wallet activity</h2></div></header>{wallet.transactions?.length ? <div className="financial-transaction-list">{wallet.transactions.map((item) => <article key={item.id}><div><strong>{item.transaction_type.replaceAll("_", " ")}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><strong>{money(item.amount_kav)}</strong></article>)}</div> : <p className="financial-empty">No simulated ledger entries yet. Actions above only create non-redeemable sandbox records.</p>}</section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">SIMULATED ONLY</span><h2>Advertisement reward credits</h2></div><p>No ad network is connected. Reward credits are separate from withdrawable KAV.</p></header>{hasAdRewards ? <button className="financial-reward-button" type="button" disabled={busy} onClick={() => run(() => supabase.rpc("techkarvo_sandbox_claim_ad_reward"), "Sample reward credit recorded without an ad network or payment.")}>Claim sample reward</button> : <p className="financial-empty">An eligible paid membership is required to claim sample reward credits.</p>}</section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">CONTRACT WORKFLOW</span><h2>Simulated milestones</h2></div><p>These records test state transitions only; they are not escrow, payment guarantees, or payout instructions.</p></header>
          {!contracts.length && <p className="financial-empty">No active contracts are available for sandbox milestones.</p>}
          {contracts.map((contract) => { const mine = milestones.filter((item) => item.contract_id === contract.id); const isClient = contract.client_id === user?.id; return <article className="financial-contract-card" key={contract.id}><h3>Contract {contract.id.slice(0, 8)} · {contract.status}</h3>
            {isClient && contract.status === "active" && <form className="financial-milestone-form" onSubmit={(event) => { event.preventDefault(); addMilestone(contract.id, event.currentTarget); }}><label>Milestone title<input name="title" minLength="3" maxLength="160" required /></label><label>Amount (KAV)<input name="amount" type="number" min="0.01" max="1000000000" step="0.01" required /></label><button disabled={busy}>Add simulated milestone</button></form>}
            {mine.map((milestone) => <div className="financial-milestone-row" key={milestone.id}><div><strong>{milestone.title}</strong><span>{money(milestone.amount_kav)} · {milestone.status}</span></div><div className="financial-milestone-actions">
              {isClient && milestone.status === "draft" && <button disabled={busy} onClick={() => milestoneAction(milestone.id,"fund")}>Simulate hold</button>}
              {!isClient && milestone.status === "funded" && <button disabled={busy} onClick={() => milestoneAction(milestone.id,"submit")}>Submit work</button>}
              {isClient && milestone.status === "submitted" && <button disabled={busy} onClick={() => milestoneAction(milestone.id,"release")}>Simulate release</button>}
              {isClient && ["funded","disputed"].includes(milestone.status) && <button disabled={busy} onClick={() => milestoneAction(milestone.id,"refund")}>Simulate refund</button>}
              {!["disputed","released","refunded"].includes(milestone.status) && <button className="secondary" disabled={busy} onClick={() => milestoneAction(milestone.id,"dispute")}>Open dispute</button>}
            </div></div>)}
          </article>; })}
        </section>
      </>}
    </div>
  </main>;
}
