import { toSafeExternalUrl } from "./external-urls.js";

export const DELIVERY_BUCKET = "techkarvo-contract-deliveries";
export const MAX_DELIVERY_FILE_SIZE = 5 * 1024 * 1024;
export const DELIVERY_FILE_TYPES = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

export function deliveryActions(contract, userId, latest) {
  const active = Boolean(userId) && contract.status === "active";
  return {
    submit: active && contract.freelancer_id === userId && (!latest || latest.status === "revision_requested"),
    decide: active && contract.client_id === userId && latest?.status === "submitted"
  };
}

export function deliveryDraftError(description, project, files) {
  if (!description.trim() || description.trim().length > 5000) return "Describe the work in 1–5,000 characters.";
  const safeProject = toSafeExternalUrl(project);
  if (project.trim() && (!safeProject || safeProject.length > 2048)) {
    return "Enter a valid HTTP or HTTPS project link without credentials.";
  }
  if (files.length > 3 || files.some((file) => !Object.hasOwn(DELIVERY_FILE_TYPES, file.type) || file.size < 1 || file.size > MAX_DELIVERY_FILE_SIZE)) {
    return "Choose up to three PDF, PNG, or JPEG files, each between 1 byte and 5 MiB.";
  }
  return "";
}

export function makeDeliveryRequest(contractId, userId, requestId, latestId, draft) {
  const files = draft.files.map((file, index) => ({
    file, path: `${contractId}/${userId}/${requestId}/${index + 1}.${DELIVERY_FILE_TYPES[file.type]}`
  }));
  return {
    files,
    uploaded: new Set(),
    payload: {
      p_contract_id: contractId,
      p_request_id: requestId,
      p_expected_latest: latestId,
      p_description: draft.description.trim(),
      p_project_url: toSafeExternalUrl(draft.project),
      p_attachment_paths: files.map(({ path }) => path)
    }
  };
}

export function isDuplicateDeliveryUpload(error) {
  const status = String(error?.statusCode ?? error?.status ?? "");
  return status === "409" || (status === "400" && (
    ["Duplicate", "ResourceAlreadyExists", "KeyAlreadyExists"].includes(error?.code ?? error?.error)
    || error?.message?.toLowerCase() === "the resource already exists"
    || error?.message?.toLowerCase() === "asset already exists"
  ));
}

export function isCompletedReviewContext(contract, application, job, userId) {
  return Boolean(userId && contract?.status === "completed" && application?.status === "Accepted" && job?.status === "completed"
    && contract.application_id === application.id && contract.job_id === application.job_id && job.id === contract.job_id
    && contract.client_id === application.client_id && contract.freelancer_id === application.freelancer_id
    && [contract.client_id, contract.freelancer_id].includes(userId));
}
