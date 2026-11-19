import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardNav from "./DashboardNav.jsx";
import { supabase } from "./supabase.js";
import { useAuth } from "./useAuth.js";

const money = (value) => `${Number(value || 0).toLocaleString()} KAV`;

export default function FinancialSandbox() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [plans, setPlans] = useState([]);
  const [entitlement, setEntitlement] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [amount, setAmount] = useState("25");

  const refresh = useCallback(async () => {
    setError("");
    const [walletResult, planResult, entitlementResult, contractsResult] = await Promise.all([
      supabase.rpc("techkarvo_sandbox_wallet"),
      supabase.from("membership_plans").select("id, account_type, slug, display_name, description, included_usage_credits, simulated_price_usdt, features, is_active").eq("account_type", user?.accountType?.toLowerCase()).eq("is_active", true).order("display_order"),
      supabase.from("membership_entitlements").select("plan_id, period_started_at, period_ends_at, period_credit_limit, credits_used").eq("user_id", user?.id).maybeSingle(),
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
          : message.includes("sample whole-USDT price") ? "This paid sample plan has no configured price yet. Ask the marketplace owner to configure its simulation price."
            : "The simulated action could not be completed. Check the sandbox configuration and try again.");
      return;
    }
    setNotice(success);
    await refresh();
  }

  function transfer(kind) {
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value < 1) { setError("Enter a whole number greater than zero."); return; }
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
    if (title.length < 3 || !Number.isSafeInteger(value) || value < 1) { setError("Enter a milestone title and a whole-number KAV amount greater than zero."); return; }
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

  return <main className="financial-sandbox-page">
    <DashboardNav user={user} />
    <div className="financial-sandbox-wrap">
      <Link className="financial-back" to={user?.accountType === "Client" ? "/client-dashboard" : "/freelancer-dashboard"}>← Dashboard</Link>
      <header className="financial-heading"><span className="admin-eyebrow">ACCOUNT TOOLS</span><h1>Membership &amp; KAV Sandbox</h1><p>Interactive simulation only. No real payments, deposits, escrow, withdrawals, or funds are enabled.</p></header>
      <div className="financial-simulation-banner" role="note"><strong>SIMULATED — NO FUNDS MOVED</strong><span>Reference only: 1 USDT = 1 KAV. This is not a market price or redemption promise.</span></div>
      {error && <p className="admin-message error" role="alert">{error}</p>}{notice && <p className="admin-message success" role="status">{notice}</p>}
      {!wallet && !error ? <p className="financial-loading" aria-live="polite">Loading sandbox…</p> : wallet && <>
        <section className="financial-wallet-card"><div><span>Available simulated balance</span><h2>{money(wallet.available_kav)}</h2><p>{money(wallet.held_kav)} currently held in simulated milestones</p></div><div className="financial-transfer"><label htmlFor="sandbox-amount">Amount (whole-number KAV / USDT)</label><input id="sandbox-amount" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} /><div><button type="button" disabled={busy} onClick={() => transfer("deposit")}>Simulate USDT deposit</button><button type="button" className="secondary" disabled={busy} onClick={() => transfer("withdraw")}>Simulate withdrawal</button></div></div></section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">ROLE SPECIFIC</span><h2>{user?.accountType} membership</h2></div><p>Role-specific benefits and prices are buyer-configured. Paid choices use simulated KAV only; monthly renewal is simulated and falls back to Free if the balance is too low.</p></header><div className="financial-plan-grid">{plans.map((plan) => { const current = entitlement?.plan_id === plan.id; const unpriced = plan.slug !== "free" && plan.simulated_price_usdt == null; return <article className="financial-plan-card" key={plan.id}><span className="financial-plan-label">SIMULATION PLAN</span><h3>{plan.display_name}</h3><p>{plan.description}</p><strong>{plan.included_usage_credits} usage credits / cycle</strong><span>{plan.simulated_price_usdt == null ? (plan.slug === "free" ? "No charge" : "Sample price not configured") : `Sample price: ${plan.simulated_price_usdt} USDT / ${plan.simulated_price_usdt} KAV`}</span>{Array.isArray(plan.features) && plan.features.length > 0 && <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}<button type="button" disabled={busy || current || unpriced} onClick={() => run(() => supabase.rpc("techkarvo_sandbox_activate_plan", { p_slug: plan.slug }), plan.slug === "free" ? "Free simulation plan selected." : "Simulated membership purchase recorded in KAV; no real payment was made.")}>{current ? "Current simulation plan" : unpriced ? "Sample price not configured" : plan.slug === "free" ? "Select Free plan" : "Purchase with simulated KAV"}</button></article>; })}</div>{entitlement && <p className="financial-entitlement">Current cycle: {entitlement.credits_used} of {entitlement.period_credit_limit} usage credits used · ends {new Date(entitlement.period_ends_at).toLocaleDateString()}</p>}</section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">SIMULATION JOURNAL</span><h2>Recent wallet activity</h2></div></header>{wallet.transactions?.length ? <div className="financial-transaction-list">{wallet.transactions.map((item) => <article key={item.id}><div><strong>{item.transaction_type.replaceAll("_", " ")}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><strong>{money(item.amount_kav)}</strong></article>)}</div> : <p className="financial-empty">No simulated ledger entries yet. Actions above only create non-redeemable sandbox records.</p>}</section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">SIMULATED ONLY</span><h2>Advertisement reward credits</h2></div><p>No ad network is connected. A test reward is limited and cannot be withdrawn as money.</p></header><button className="financial-reward-button" type="button" disabled={busy} onClick={() => run(() => supabase.rpc("techkarvo_sandbox_claim_ad_reward"), "Sample reward credit recorded without an ad network or payment.")}>Claim sample reward</button></section>
        <section className="financial-section"><header><div><span className="admin-eyebrow">CONTRACT WORKFLOW</span><h2>Simulated milestones</h2></div><p>These records test state transitions only; they are not escrow, payment guarantees, or payout instructions.</p></header>
          {!contracts.length && <p className="financial-empty">No active contracts are available for sandbox milestones.</p>}
          {contracts.map((contract) => { const mine = milestones.filter((item) => item.contract_id === contract.id); const isClient = contract.client_id === user?.id; return <article className="financial-contract-card" key={contract.id}><h3>Contract {contract.id.slice(0, 8)} · {contract.status}</h3>
            {isClient && contract.status === "active" && <form className="financial-milestone-form" onSubmit={(event) => { event.preventDefault(); addMilestone(contract.id, event.currentTarget); }}><label>Milestone title<input name="title" minLength="3" maxLength="160" required /></label><label>Amount (KAV)<input name="amount" type="number" min="1" max="1000000000" step="1" required /></label><button disabled={busy}>Add simulated milestone</button></form>}
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
