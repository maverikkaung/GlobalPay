import test from "node:test";
import assert from "node:assert/strict";
import { filterJobs, formatJobBudget, jobJourneyPath, readJobFilters } from "./job-discovery.js";

test("job links round-trip supported filters and discard unrelated parameters", () => {
  const search = "?q=React+%26+CSS&category=Web+Development&sort=title&advanced=1&minBudget=50.00&maxBudget=900&token=obsolete";
  assert.equal(jobJourneyPath("/jobs/one", search), "/jobs/one?q=React+%26+CSS&category=Web+Development&sort=title&advanced=1&minBudget=50&maxBudget=900");
  const invalid = readJobFilters(new URLSearchParams("q=%00bad&category=unknown&sort=invalid&advanced=true&minBudget=-1&maxBudget=1e3"), ["Web Development"]);
  assert.deepEqual(invalid, { query: "", category: "", sort: "newest", advanced: false, minBudget: "", maxBudget: "" });
});

test("budget filters apply only when the feature is allowed and the user opened them", () => {
  const jobs = [
    { title: "Zulu", skills: ["React"], category: "Web Development", budget: 80 },
    { title: "Alpha", skills: ["React"], category: "Web Development", budget: 20 }
  ];
  const filters = readJobFilters(new URLSearchParams("q=react&sort=title&advanced=1&minBudget=50"));
  assert.deepEqual(filterJobs(jobs, filters, false).map((job) => job.title), ["Alpha", "Zulu"]);
  assert.deepEqual(filterJobs(jobs, { ...filters, advanced: false }, true).map((job) => job.title), ["Alpha", "Zulu"]);
  assert.deepEqual(filterJobs(jobs, filters, true).map((job) => job.title), ["Zulu"]);
});

test("job budgets retain the available currency and hourly unit", () => {
  assert.equal(formatJobBudget({ budget: 80, currency: "EUR", paymentType: "Hourly" }), "EUR 80 / hour");
  assert.equal(formatJobBudget({ budget: 80, currency: "", paymentType: "Hourly" }), "Budget unavailable");
});
