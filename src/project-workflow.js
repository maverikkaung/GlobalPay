export function isOptionalContractSchemaMissing(error) {
  return ["PGRST205", "42P01"].includes(error?.code);
}

export function getAcceptedWorkPresentation({ applicationStatus, jobStatus, contractStatus }) {
  if (applicationStatus !== "Accepted") return null;

  if (contractStatus === "disputed") {
    return { label: "Contract under review", detail: "TechKarvo does not hold or transfer payment." };
  }
  if (contractStatus === "cancelled") {
    return { label: "Contract cancelled", detail: "No payment was secured by TechKarvo." };
  }
  if (contractStatus === "completed" || jobStatus === "completed") {
    return { label: "Project completed", detail: "Verified project reviews can be submitted." };
  }
  if (contractStatus === "active") {
    return { label: "Active contract", detail: "No payment is held or secured by TechKarvo." };
  }

  return {
    label: "Freelancer hired",
    detail: "Contract tracking is unavailable; payment is not held or secured by TechKarvo."
  };
}
