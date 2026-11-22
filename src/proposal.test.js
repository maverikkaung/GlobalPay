import test from "node:test";
import assert from "node:assert/strict";
import { availableApplicationQuota, buildProposal, validateProposal } from "./proposal.js";

const draft = { fullName: " Worker ", country: "Myanmar", title: "Engineer", bio: "Developer", skills: "React", experience: "1-2 years",
  coverLetter: " Here is the approach. ", salary: "120.50", salaryType: "Hourly", portfolio: "https://example.com/work" };

test("proposal validation rejects placeholder whitespace, unsafe URLs and invalid rates", () => {
  assert.deepEqual(validateProposal(draft), {});
  assert.deepEqual(Object.keys(validateProposal({ ...draft, fullName: "  ", experience: "", salary: "0", portfolio: "javascript:alert(1)" })).sort(),
    ["experience", "fullName", "portfolio", "salary"]);
});

test("proposal payload keeps the existing status and derives both participants from verified records", () => {
  const result = buildProposal(draft, { id: "worker", email: "worker@example.invalid" }, { id: "job", clientId: "owner" });
  assert.deepEqual([result.job_id, result.client_id, result.freelancer_id, result.status], ["job", "owner", "worker", "Pending"]);
  assert.equal(result.full_name, "Worker");
  assert.equal(result.email, "worker@example.invalid");
  assert.equal(result.expected_salary, 120.5);
});

test("quota presentation clamps to the active catalog and defers to the server after expiry or plan changes", () => {
  const now = Date.parse("2026-11-21T00:00:00Z");
  const entitlement = { plan_id: "plan", period_credit_limit: 10, credits_used: 3,
    period_started_at: "2026-11-01T00:00:00Z", period_ends_at: "2026-12-01T00:00:00Z" };
  const plan = { id: "plan", account_type: "freelancer", included_usage_credits: 5, is_active: true, is_simulation_only: true };
  assert.equal(availableApplicationQuota(entitlement, plan, now).remaining, 2);
  assert.equal(availableApplicationQuota({ ...entitlement, credits_used: 8 }, plan, now).remaining, 0);
  assert.equal(availableApplicationQuota(entitlement, { ...plan, is_active: false }, now), null);
  assert.equal(availableApplicationQuota(entitlement, plan, Date.parse(entitlement.period_ends_at)), null);
});
