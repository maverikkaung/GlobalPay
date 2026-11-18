import test from "node:test";
import assert from "node:assert/strict";
import { getAcceptedWorkPresentation, isOptionalContractSchemaMissing } from "./project-workflow.js";

test("accepted work distinguishes active, completed, disputed, and legacy contracts", () => {
  assert.match(getAcceptedWorkPresentation({ applicationStatus: "Accepted", contractStatus: "active" }).label, /Active contract/);
  assert.match(getAcceptedWorkPresentation({ applicationStatus: "Accepted", jobStatus: "completed" }).label, /Project completed/);
  assert.match(getAcceptedWorkPresentation({ applicationStatus: "Accepted", contractStatus: "disputed" }).label, /under review/);
  assert.match(getAcceptedWorkPresentation({ applicationStatus: "Accepted" }).detail, /not held or secured/);
  assert.equal(getAcceptedWorkPresentation({ applicationStatus: "Pending" }), null);
});

test("only a missing optional contract relation is treated as a legacy schema", () => {
  assert.equal(isOptionalContractSchemaMissing({ code: "PGRST205" }), true);
  assert.equal(isOptionalContractSchemaMissing({ code: "42P01" }), true);
  assert.equal(isOptionalContractSchemaMissing({ code: "42501" }), false);
  assert.equal(isOptionalContractSchemaMissing(null), false);
});
