import test from "node:test";
import assert from "node:assert/strict";
import {
  createDemoFinancials, DEMO_AD_REWARD_LIMIT, DEMO_KAV_PER_USDT, disputeDemoMilestone,
  fundDemoMilestone, refundDemoMilestone, releaseDemoMilestone, selectDemoMembership,
  simulateDemoAdReward, simulateDemoUsdtFunding
} from "./demo-financials.js";

const milestone = "demo-milestone-design";

function assertBalanced(financials) {
  for (const entry of financials.transactions) {
    assert.equal(entry.simulated, true);
    assert.equal(entry.currency, "KAV");
    assert.equal(entry.lines.reduce((sum, line) => sum + line.deltaKav, 0), 0);
  }
}

test("demo USDT funding uses only the fixed sample rate and balanced ledger lines", () => {
  const initial = createDemoFinancials();
  const result = simulateDemoUsdtFunding(initial, "client", 100);
  assert.equal(result.ok, true);
  assert.equal(DEMO_KAV_PER_USDT, 1);
  assert.equal(result.state.balances.clientAvailable, 2600);
  assert.equal(result.state.transactions[0].type, "simulated_usdt_credit");
  assert.match(result.state.transactions[0].note, /no provider request/i);
  assertBalanced(result.state);
});

test("milestone hold, commission release, and refund use isolated simulated balances", () => {
  const initial = createDemoFinancials();
  const held = fundDemoMilestone(initial, milestone);
  assert.equal(held.ok, true);
  assert.equal(held.state.balances.clientAvailable, 1700);
  assert.equal(held.state.milestones[0].status, "funded");
  const released = releaseDemoMilestone(held.state, milestone);
  assert.equal(released.ok, true);
  assert.equal(released.state.balances.freelancerAvailable, 1920);
  assert.equal(released.state.balances.platformCommission, 80);
  assert.equal(released.state.milestones[0].status, "released");
  assert.equal(refundDemoMilestone(held.state, milestone).state.balances.clientAvailable, 2500);
  assertBalanced(released.state);
});

test("demo dispute freezes its hold until a simulated release or refund decision", () => {
  const funded = fundDemoMilestone(createDemoFinancials(), milestone).state;
  const disputed = disputeDemoMilestone(funded, milestone);
  assert.equal(disputed.ok, true);
  assert.equal(disputed.state.milestones[0].status, "disputed");
  assert.equal(disputed.state.balances.clientAvailable, 1700);
  assert.equal(releaseDemoMilestone(disputed.state, milestone).state.milestones[0].status, "released");
  assert.equal(refundDemoMilestone(disputed.state, milestone).state.milestones[0].status, "refunded");
});

test("invalid demo ledger actions and excess rewards are rejected", () => {
  const initial = createDemoFinancials();
  assert.equal(fundDemoMilestone(initial, "missing").ok, false);
  assert.equal(simulateDemoUsdtFunding(initial, "admin", 100).ok, false);
  assert.equal(simulateDemoUsdtFunding(initial, "client", 1001).ok, false);
  let state = initial;
  for (let i = 0; i < DEMO_AD_REWARD_LIMIT; i += 1) {
    const next = simulateDemoAdReward(state, "freelancer");
    assert.equal(next.ok, true);
    state = next.state;
  }
  assert.equal(simulateDemoAdReward(state, "freelancer").ok, false);
  assertBalanced(state);
});

test("sample membership switching records no payment or financial transaction", () => {
  const initial = createDemoFinancials();
  const result = selectDemoMembership(initial, "client", "gold");
  assert.equal(result.ok, true);
  assert.equal(result.state.membership.client, "gold");
  assert.equal(result.state.transactions.length, initial.transactions.length);
  assert.equal(selectDemoMembership(result.state, "admin", "premium").ok, false);
});
