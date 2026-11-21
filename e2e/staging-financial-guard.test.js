import assert from "node:assert/strict";
import test from "node:test";
import { guardSandboxTransfers, requireQaRunId } from "./staging-financial-guard.js";
import { stagingProjectRef } from "../scripts/staging-qa-storage.js";

async function setup(role, phase) {
  let route;
  await guardSandboxTransfers({ route: (matches, handler) => { route = { matches, handler }; } },
    { runId: "approved-run-1", role, phase });
  return (action, amount) => {
    const path = `/rest/v1/rpc/techkarvo_sandbox_${action}`;
    const url = new URL(`https://${stagingProjectRef}.supabase.co${path}`);
    assert.equal(route.matches(url), true);
    assert.equal(route.matches(new URL(path, "https://unrelated.invalid")), false);
    return route.handler({
      request: () => ({ method: () => "POST", url: () => url.href,
        postDataJSON: () => action === "activate_plan" ? { p_slug: amount }
          : { [action === "deposit" ? "p_usdt" : "p_amount_kav"]: amount, p_idempotency_key: "random" } }),
      fulfill: ({ status }) => status,
      fallback: (override) => override ? JSON.parse(override.postData).p_idempotency_key : "allowed"
    });
  };
}

test("approved-run keys survive a restart and distinguish role, phase and action", async () => {
  const verifyClient = await setup("Client", "verify");
  const verifyRestart = await setup("Client", "verify");
  const verifyFreelancer = await setup("Freelancer", "verify");
  const setupClient = await setup("Client", "setup");
  const first = verifyClient("deposit", 0.01);
  assert.equal(first, verifyRestart("deposit", 0.01));
  assert.equal(new Set([first, verifyClient("withdraw", 0.01), verifyFreelancer("deposit", 0.01), setupClient("deposit", 39.99)]).size, 4);
  assert.equal(verifyClient("deposit", 0.01), 403);
});

test("staging finance rejects a missing run ID, excess amounts and out-of-scope setup withdrawals", async () => {
  assert.throws(() => requireQaRunId());
  const setupFreelancer = await setup("Freelancer", "setup");
  const verifyClient = await setup("Client", "verify");
  assert.equal(setupFreelancer("deposit", 5), 403);
  assert.equal(setupFreelancer("withdraw", 0.01), 403);
  assert.equal(verifyClient("deposit", 0.02), 403);
  assert.equal(verifyClient("withdraw", 0.015), 403);
});

test("only the approved role-specific setup purchase can reach staging once", async () => {
  const setupClient = await setup("Client", "setup");
  const setupFreelancer = await setup("Freelancer", "setup");
  const verifyClient = await setup("Client", "verify");
  assert.equal(setupClient("activate_plan", "plus"), 403);
  assert.equal(setupClient("activate_plan", "premium"), "allowed");
  assert.equal(setupClient("activate_plan", "premium"), 403);
  assert.equal(setupFreelancer("activate_plan", "plus"), "allowed");
  assert.equal(verifyClient("activate_plan", "premium"), 403);
});
