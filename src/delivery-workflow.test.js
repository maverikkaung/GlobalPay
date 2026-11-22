import assert from "node:assert/strict";
import test from "node:test";
import { deliveryActions, deliveryDraftError, isCompletedReviewContext, isDuplicateDeliveryUpload, makeDeliveryRequest } from "./delivery-workflow.js";

const contract = { id: "contract", status: "active", client_id: "client", freelancer_id: "freelancer", application_id: "application", job_id: "job" };

test("delivery actions depend on participant, active contract and latest version", () => {
  assert.deepEqual(deliveryActions(contract, "freelancer"), { submit: true, decide: false });
  assert.deepEqual(deliveryActions(contract, "client", { status: "submitted" }), { submit: false, decide: true });
  assert.equal(deliveryActions(contract, "freelancer", { status: "submitted" }).submit, false);
  assert.equal(deliveryActions(contract, "freelancer", { status: "revision_requested" }).submit, true);
  for (const user of ["client", "freelancer", "outsider", undefined]) {
    assert.deepEqual(deliveryActions(contract, user, { status: "approved" }), { submit: false, decide: false });
    for (const status of ["completed", "cancelled", "disputed"]) {
      assert.deepEqual(deliveryActions({ ...contract, status }, user), { submit: false, decide: false });
    }
  }
});

test("delivery validates description, safe project link and attachment limits", () => {
  const pdf = { type: "application/pdf", size: 5242880 };
  assert.equal(deliveryDraftError("Final files", "https://example.invalid/work", [pdf, pdf, pdf]), "");
  assert.match(deliveryDraftError("  ", "", []), /Describe the work/);
  assert.match(deliveryDraftError("x".repeat(5001), "", []), /Describe the work/);
  assert.match(deliveryDraftError("Files", "https://user@example.invalid", []), /valid HTTP or HTTPS/);
  assert.match(deliveryDraftError("Files", "javascript:alert(1)", []), /valid HTTP or HTTPS/);
  for (const files of [[pdf, pdf, pdf, pdf], [{ ...pdf, size: 0 }], [{ ...pdf, size: 5242881 }], [{ ...pdf, type: "image/svg+xml" }]]) {
    assert.match(deliveryDraftError("Files", "", files), /up to three/);
  }
});

test("submission ties immutable attachment paths to the attempt and its expected predecessor", () => {
  const file = { name: "private name.pdf", type: "application/pdf", size: 10 };
  const request = makeDeliveryRequest("cid", "fid", "rid", "previous", { description: " Final work ", project: "https://example.invalid", files: [file] });
  assert.deepEqual(request.payload, {
    p_contract_id: "cid", p_request_id: "rid", p_expected_latest: "previous", p_description: "Final work",
    p_project_url: "https://example.invalid/", p_attachment_paths: ["cid/fid/rid/1.pdf"]
  });
  assert.deepEqual(request.files, [{ file, path: "cid/fid/rid/1.pdf" }]);
  assert.equal(isDuplicateDeliveryUpload({ statusCode: "409" }), true);
  assert.equal(isDuplicateDeliveryUpload({ status: 400, error: "Duplicate" }), true);
  assert.equal(isDuplicateDeliveryUpload({ statusCode: "400", code: "ResourceAlreadyExists" }), true);
  assert.equal(isDuplicateDeliveryUpload({ statusCode: "400", message: "Asset already exists" }), true);
  assert.equal(isDuplicateDeliveryUpload({ statusCode: "400", message: "Invalid MIME" }), false);
  assert.equal(isDuplicateDeliveryUpload({ statusCode: "403" }), false);
});

test("workroom review scope requires both completed states, accepted application and matching participants", () => {
  const completed = { ...contract, status: "completed" };
  const application = { id: "application", status: "Accepted", job_id: "job", client_id: "client", freelancer_id: "freelancer" };
  const job = { id: "job", status: "completed" };
  for (const user of ["client", "freelancer"]) assert.equal(isCompletedReviewContext(completed, application, job, user), true);
  assert.equal(isCompletedReviewContext(contract, application, job, "client"), false);
  assert.equal(isCompletedReviewContext(completed, application, { ...job, status: "open" }, "client"), false);
  assert.equal(isCompletedReviewContext(completed, { ...application, freelancer_id: "other" }, job, "client"), false);
  assert.equal(isCompletedReviewContext(completed, application, job, "outsider"), false);
});
