import test from "node:test";
import assert from "node:assert/strict";
import { buildContractTimeline, isContractParticipant, matchesContractContext } from "./contract-workroom.js";

const contract = { client_id: "client", freelancer_id: "freelancer", job_id: "job", created_at: "2026-10-10", completed_at: "2026-10-15" };

test("workroom membership and linkage require matching participants and job", () => {
  assert.equal(isContractParticipant(contract, "client"), true);
  assert.equal(isContractParticipant(contract, "freelancer"), true);
  assert.equal(isContractParticipant(contract, "staff"), false);
  assert.equal(matchesContractContext({ ...contract, job_id: "another" }, contract), false);
  assert.equal(matchesContractContext(contract, contract), true);
});

test("workroom activity separates contract completion, submission and simulated release", () => {
  const make = (id, milestone_id, event_type, created_at) => ({ id, milestone_id, event_type, created_at });
  const entries = buildContractTimeline(contract, [{ id: "milestone", title: "Design" }], [
    make(1, "milestone", "submitted", "2026-10-13"), make(2, "milestone", "released", "2026-10-14"),
    make(3, "other", "refunded", "2026-10-16"), make(4, "milestone", "disputed", "invalid")
  ]);
  assert.deepEqual(entries.map(({ label }) => label), ["Contract completed", "Design · Simulated funds released", "Design · Work submitted", "Contract created"]);
});
