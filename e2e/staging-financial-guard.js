import { isStagingBackend } from "./qa-deletion-guard.js";

const transferFields = { deposit: "p_usdt", withdraw: "p_amount_kav" };
const setupLimitCents = { Client: 3999, Freelancer: 499 };
const setupPlan = { Client: "premium", Freelancer: "plus" };
const actions = ["deposit", "withdraw", "activate_plan"];

export function requireQaRunId(runId) {
  if (!/^[a-z0-9][a-z0-9_-]{7,63}$/.test(runId || "")) {
    throw new Error("Set the assigned staging QA run ID before starting a write test.");
  }
  return runId;
}

export async function guardSandboxTransfers(page, { runId, role, phase }) {
  requireQaRunId(runId);
  if (!Object.hasOwn(setupLimitCents, role) || !["setup", "verify"].includes(phase)) {
    throw new Error("Unknown staging financial test scope.");
  }
  const submitted = new Set();
  await page.route((url) => actions.some((action) =>
    isStagingBackend(url, `/rest/v1/rpc/techkarvo_sandbox_${action}`)), (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fallback();
    const action = new URL(request.url()).pathname.split("techkarvo_sandbox_").at(-1);
    let body;
    try { body = request.postDataJSON(); } catch { body = null; }
    const amount = body?.[transferFields[action]];
    const cents = Math.round(amount * 100);
    const valid = Number.isFinite(amount) && cents / 100 === amount && cents > 0
      && (phase === "setup" ? action === "deposit" && cents <= setupLimitCents[role] : cents === 1);
    const permitted = action === "activate_plan" ? phase === "setup" && body?.p_slug === setupPlan[role] : valid;
    if (request.method() !== "POST" || !permitted || submitted.has(action)) {
      return route.fulfill({ status: 403, json: { message: "Sandbox transfer is outside this QA run's scope." } });
    }
    submitted.add(action);
    if (action === "activate_plan") return route.fallback();
    return route.fallback({ postData: JSON.stringify({
      [transferFields[action]]: amount,
      p_idempotency_key: `qa-e2e:${runId}:${role.toLowerCase()}:${phase}:${action}`
    }) });
  });
}
