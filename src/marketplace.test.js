import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateClientHiringMetrics,
  countApplicationStatuses,
  normalizeAccountType,
  parseSkills
} from "./marketplace.js";

test("account roles accept only supported database values", () => {
  assert.equal(normalizeAccountType("client"), "Client");
  assert.equal(normalizeAccountType("freelancer"), "Freelancer");
  assert.equal(normalizeAccountType("admin"), null);
  assert.equal(normalizeAccountType(null), null);
});

test("application summaries count only known workflow statuses", () => {
  assert.deepEqual(countApplicationStatuses([
    { status: "Accepted" }, { status: "Pending" }, { status: "Rejected" }, { status: "withdrawn" }
  ]), { accepted: 1, pending: 1, rejected: 1 });
});

test("client hiring totals count each hire and each accepted job budget once", () => {
  assert.deepEqual(calculateClientHiringMetrics([
    { job_id: 7, status: "Accepted" },
    { job_id: "7", status: "Accepted" },
    { job_id: 8, status: "Pending" }
  ], [
    { id: 7, budget: "250" }, { id: 8, budget: 900 }, { id: 9, budget: 120 }
  ]), { totalHires: 2, totalSpending: 250 });
});

test("skill values work as either database arrays or comma-separated strings", () => {
  assert.deepEqual(parseSkills("React, CSS, , JavaScript "), ["React", "CSS", "JavaScript"]);
  assert.deepEqual(parseSkills(["Design", " Research "]), ["Design", "Research"]);
  assert.deepEqual(parseSkills(null), []);
});
