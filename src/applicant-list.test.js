import test from "node:test";
import assert from "node:assert/strict";
import { filterApplicants, sortApplicants } from "./applicant-list.js";

const applicants = [
  { id: "a", job_id: "j1", freelancer_id: "f1", full_name: "Archived name", professional_title: "Legacy title", skills: "React", job_title: "Marketplace UI", status: "Pending", expected_salary: 1200, applied_at: "2026-11-16T00:00:00Z" },
  { id: "b", job_id: "j2", freelancer_id: "f2", full_name: "Sam Lee", professional_title: "Designer", skills: "Figma", job_title: "Brand design", status: "Accepted", expected_salary: 800, applied_at: "2026-11-17T00:00:00Z" }
];

test("applicant search uses current public profile and historical fallback fields", () => {
  assert.deepEqual(filterApplicants(applicants, { query: "updated developer" }, {
    f1: { full_name: "Updated name", professional_title: "Developer" }
  }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterApplicants(applicants, { query: "legacy title" }).map((item) => item.id), ["a"]);
});

test("applicant filters combine job and status without changing source data", () => {
  assert.deepEqual(filterApplicants(applicants, { jobId: "j2", status: "Accepted" }).map((item) => item.id), ["b"]);
  assert.deepEqual(applicants.map((item) => item.id), ["a", "b"]);
});

test("applicant sorting supports date, budget, and verified rating", () => {
  assert.deepEqual(sortApplicants(applicants).map((item) => item.id), ["b", "a"]);
  assert.deepEqual(sortApplicants(applicants, "oldest").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(sortApplicants(applicants, "budget-high").map((item) => item.id), ["a", "b"]);
  assert.deepEqual(sortApplicants(applicants, "rating-high", {
    f1: { average: 4.8 }, f2: { average: 4.1 }
  }).map((item) => item.id), ["a", "b"]);
});
