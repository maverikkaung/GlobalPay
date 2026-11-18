import assert from "node:assert/strict";
import test from "node:test";
import { getProfilePath, getQuickActions } from "./dashboard-navigation.js";

test("client quick actions contain only client workflow destinations", () => {
  assert.deepEqual(getQuickActions("Client"), [
    ["Daily Feed", "/social"],
    ["Post a Job", "/post-job"],
    ["My Applicants", "/job-applicants"],
    ["My Freelancers", "/my-freelancers"],
    ["My Projects", "/my-projects"],
    ["Reviews", "/reviews"]
  ]);
});

test("freelancer quick actions contain only freelancer workflow destinations", () => {
  assert.deepEqual(getQuickActions("Freelancer"), [
    ["Daily Feed", "/social"],
    ["Find Jobs", "/jobs"],
    ["My Applications", "/my-applications"],
    ["My Portfolio", "/portfolio"],
    ["Reviews", "/reviews"]
  ]);
});

test("Quick Actions omit dedicated header features and unsupported roles have no actions", () => {
  for (const role of ["Client", "Freelancer"]) {
    const entries = getQuickActions(role);
    const routes = entries.map(([, path]) => path);
    assert.equal(new Set(routes).size, routes.length);
    assert.equal(routes.some((path) => ["/messages", "/notifications", "/client-profile", "/freelancer-profile"].includes(path)), false);
  }
  assert.deepEqual(getQuickActions("Admin"), []);
});

test("profile links resolve only to existing role-specific pages", () => {
  assert.equal(getProfilePath("Client"), "/client-profile");
  assert.equal(getProfilePath("Freelancer"), "/freelancer-profile");
  assert.equal(getProfilePath(null), null);
});
