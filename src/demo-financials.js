export const DEMO_KAV_PER_USDT = 1;
export const DEMO_COMMISSION_BPS = 1000;
export const DEMO_AD_REWARD_KAV = 1;
export const DEMO_AD_REWARD_LIMIT = 5;

const account = (role) => `wallet:${role}:available`;
const heldAccount = (milestoneId) => `escrow:${milestoneId}:held`;

function transaction(id, type, amountKav, lines, note, createdAt = new Date().toISOString()) {
  return { id, type, amountKav, currency: "KAV", simulated: true, note, createdAt, lines };
}

export function createDemoFinancials() {
  return {
    balances: { clientAvailable: 2500, freelancerAvailable: 1200, platformCommission: 0 },
    commissionBps: DEMO_COMMISSION_BPS,
    milestones: [{ id: "demo-milestone-design", jobId: "demo-job-2", title: "Design system handoff", amountKav: 800, status: "unfunded" }],
    transactions: [
      transaction("demo-credit-client", "sandbox_credit", 2500,
        [{ account: "sandbox:clearing", deltaKav: -2500 }, { account: account("client"), deltaKav: 2500 }], "Sample-only starting balance", "2026-11-19T00:00:00.000Z"),
      transaction("demo-credit-freelancer", "sandbox_credit", 1200,
        [{ account: "sandbox:clearing", deltaKav: -1200 }, { account: account("freelancer"), deltaKav: 1200 }], "Sample-only starting balance", "2026-11-19T00:00:00.000Z")
    ],
    membership: { client: "free", freelancer: "free" },
    adRewards: { client: 0, freelancer: 0 }
  };
}

function applyTransaction(financials, entry, balanceChanges) {
  const sum = entry.lines.reduce((total, line) => total + line.deltaKav, 0);
  if (sum !== 0) return { ok: false, state: financials, message: "This sample transaction did not balance." };
  return {
    ok: true,
    state: {
      ...financials,
      balances: { ...financials.balances, ...balanceChanges },
      transactions: [entry, ...financials.transactions]
    },
    message: "Simulated transaction recorded. No funds moved."
  };
}

function findMilestone(financials, id) {
  return financials.milestones.find((item) => item.id === id);
}

export function fundDemoMilestone(financials, milestoneId) {
  const milestone = findMilestone(financials, milestoneId);
  if (!milestone || milestone.status !== "unfunded") return { ok: false, state: financials, message: "This sample milestone is not available to fund." };
  if (financials.balances.clientAvailable < milestone.amountKav) return { ok: false, state: financials, message: "The sample Client balance is too low." };
  const entry = transaction(`demo-fund-${milestone.id}`, "simulated_escrow_hold", milestone.amountKav,
    [{ account: account("client"), deltaKav: -milestone.amountKav }, { account: heldAccount(milestone.id), deltaKav: milestone.amountKav }],
    "Simulated milestone hold; no provider or real funds involved.");
  const result = applyTransaction(financials, entry, { clientAvailable: financials.balances.clientAvailable - milestone.amountKav });
  if (!result.ok) return result;
  result.state.milestones = financials.milestones.map((item) => item.id === milestone.id ? { ...item, status: "funded" } : item);
  return result;
}

export function simulateDemoUsdtFunding(financials, role, amountUsdt = 100) {
  if (!["client", "freelancer"].includes(role) || !Number.isInteger(amountUsdt) || amountUsdt < 1 || amountUsdt > 1000) {
    return { ok: false, state: financials, message: "Choose a whole-number sandbox amount from 1 to 1,000 USDT." };
  }
  const amountKav = amountUsdt * DEMO_KAV_PER_USDT;
  const entry = transaction(`demo-usdt-${role}-${Date.now()}`, "simulated_usdt_credit", amountKav,
    [{ account: "sandbox:usdt-clearing", deltaKav: -amountKav }, { account: account(role), deltaKav: amountKav }],
    `Simulated ${amountUsdt} USDT at the fixed demo rule 1 USDT = 1 KAV; no provider request was sent.`);
  const balanceField = role === "client" ? "clientAvailable" : "freelancerAvailable";
  return applyTransaction(financials, entry, { [balanceField]: financials.balances[balanceField] + amountKav });
}

export function releaseDemoMilestone(financials, milestoneId) {
  const milestone = findMilestone(financials, milestoneId);
  if (!milestone || !["funded", "disputed"].includes(milestone.status)) return { ok: false, state: financials, message: "Only a funded sample milestone can be released." };
  const fee = Math.round(milestone.amountKav * Math.min(Math.max(financials.commissionBps, 0), 10_000) / 10_000);
  const payout = milestone.amountKav - fee;
  const entry = transaction(`demo-release-${milestone.id}`, "simulated_release", milestone.amountKav,
    [{ account: heldAccount(milestone.id), deltaKav: -milestone.amountKav }, { account: account("freelancer"), deltaKav: payout }, { account: "platform:simulated_commission", deltaKav: fee }],
    `Sample commission ${(financials.commissionBps / 100).toFixed(1)}%; no real payout.`);
  const result = applyTransaction(financials, entry, {
    freelancerAvailable: financials.balances.freelancerAvailable + payout,
    platformCommission: financials.balances.platformCommission + fee
  });
  if (!result.ok) return result;
  result.state.milestones = financials.milestones.map((item) => item.id === milestone.id ? { ...item, status: "released" } : item);
  return result;
}

export function refundDemoMilestone(financials, milestoneId) {
  const milestone = findMilestone(financials, milestoneId);
  if (!milestone || !["funded", "disputed"].includes(milestone.status)) return { ok: false, state: financials, message: "Only held sample funds can be refunded." };
  const entry = transaction(`demo-refund-${milestone.id}`, "simulated_refund", milestone.amountKav,
    [{ account: heldAccount(milestone.id), deltaKav: -milestone.amountKav }, { account: account("client"), deltaKav: milestone.amountKav }],
    "Sample refund; no provider or real funds involved.");
  const result = applyTransaction(financials, entry, { clientAvailable: financials.balances.clientAvailable + milestone.amountKav });
  if (!result.ok) return result;
  result.state.milestones = financials.milestones.map((item) => item.id === milestone.id ? { ...item, status: "refunded" } : item);
  return result;
}

export function disputeDemoMilestone(financials, milestoneId) {
  const milestone = findMilestone(financials, milestoneId);
  if (!milestone || milestone.status !== "funded") return { ok: false, state: financials, message: "Only a funded sample milestone can be disputed." };
  return {
    ok: true,
    state: { ...financials, milestones: financials.milestones.map((item) => item.id === milestone.id ? { ...item, status: "disputed" } : item) },
    message: "Sample dispute opened. The sample hold remains unchanged."
  };
}

export function simulateDemoAdReward(financials, role) {
  if (!["client", "freelancer"].includes(role)) return { ok: false, state: financials, message: "Choose a sample member first." };
  if (financials.adRewards[role] >= DEMO_AD_REWARD_LIMIT) return { ok: false, state: financials, message: "The sample reward limit has been reached." };
  const entry = transaction(`demo-ad-${role}-${financials.adRewards[role] + 1}`, "simulated_ad_reward", DEMO_AD_REWARD_KAV,
    [{ account: "sandbox:ad-reward-pool", deltaKav: -DEMO_AD_REWARD_KAV }, { account: account(role), deltaKav: DEMO_AD_REWARD_KAV }],
    "Sample ad reward; no ad network was contacted.");
  const balanceField = role === "client" ? "clientAvailable" : "freelancerAvailable";
  const result = applyTransaction(financials, entry, { [balanceField]: financials.balances[balanceField] + DEMO_AD_REWARD_KAV });
  if (!result.ok) return result;
  result.state.adRewards = { ...financials.adRewards, [role]: financials.adRewards[role] + 1 };
  return result;
}

export function selectDemoMembership(financials, role, tier) {
  if (!["client", "freelancer"].includes(role) || !["free", "plus", "gold", "premium"].includes(tier)) {
    return { ok: false, state: financials, message: "Choose a listed sample tier." };
  }
  return {
    ok: true,
    state: { ...financials, membership: { ...financials.membership, [role]: tier } },
    message: "Sample membership changed. No subscription or charge was created."
  };
}
