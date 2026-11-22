import assert from "node:assert/strict";
import test from "node:test";
import { isProfileId, mayShowPortfolio, profileConnection, profileMediaPath, profileSkills } from "./profile-preview.js";

const owner = "30000000-0000-4000-8000-000000000001";
const visitor = "30000000-0000-4000-8000-000000000002";
const profile = { id: owner, account_type: "freelancer" };

test("portfolio rows are shown only to the Freelancer owner or a signed-in Client", () => {
  assert.equal(mayShowPortfolio(profile, { id: owner, accountType: "Freelancer" }), true);
  assert.equal(mayShowPortfolio(profile, { id: visitor, accountType: "Client" }), true);
  assert.equal(mayShowPortfolio(profile, { id: visitor, accountType: "Freelancer" }), false);
  assert.equal(mayShowPortfolio(profile, null), false);
  assert.equal(mayShowPortfolio({ ...profile, account_type: "client" }, { id: visitor, accountType: "Client" }), false);
});

test("profile media only resolves safe object paths under the profile owner folder", () => {
  assert.equal(profileMediaPath(`${owner}/avatar.png`, owner), `${owner}/avatar.png`);
  for (const path of [`${visitor}/avatar.png`, `${owner}/../private`, `${owner}/%2favatar`, `${owner}//avatar`, `${owner}/avatar?download`, "https://example.com/image"]) {
    assert.equal(profileMediaPath(path, owner), null);
  }
});

test("profile identifiers and skills use only actual values", () => {
  assert.equal(isProfileId(owner), true);
  assert.equal(isProfileId(`${owner},recipient_id.eq.123`), false);
  assert.deepEqual(profileSkills(" UX, , UX, UI Design, 日本語 "), ["UX", "UI Design", "日本語"]);
  assert.deepEqual(profileSkills(null), []);
});

test("networking labels keep pending and declined actions disabled", () => {
  assert.deepEqual(profileConnection(null, owner), { label: "Connect", disabled: false });
  assert.deepEqual(profileConnection({ status: "Pending", requester_id: owner }, owner), { label: "Request pending", disabled: true });
  assert.deepEqual(profileConnection({ status: "Pending", requester_id: visitor }, owner), { label: "Accept connection", disabled: false });
  assert.deepEqual(profileConnection({ status: "Accepted" }, owner), { label: "Message", disabled: false });
  assert.deepEqual(profileConnection({ status: "Declined" }, owner), { label: "Request declined", disabled: true });
});
