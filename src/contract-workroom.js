export const contractStates = {
  active: ["Active", "This contract is in progress."],
  completed: ["Completed", "The contract has ended. Completion records the work status only."],
  disputed: ["Disputed", "A dispute is recorded for this contract. Review the project and its milestone history."],
  cancelled: ["Cancelled", "This contract was cancelled. Its existing history remains available."]
};

export const milestoneStates = {
  draft: "Draft", funded: "Simulated funds held", submitted: "Work submitted",
  disputed: "In dispute", released: "Simulated funds released", refunded: "Simulated refund"
};

export function isContractParticipant(contract, userId) {
  return Boolean(userId && contract && (contract.client_id === userId || contract.freelancer_id === userId));
}

export function matchesContractContext(record, contract) {
  return Boolean(record && record.client_id === contract.client_id && record.freelancer_id === contract.freelancer_id
    && String(record.job_id) === String(contract.job_id));
}

export function buildContractTimeline(contract, milestones, events) {
  const names = new Map(milestones.map((item) => [item.id, item.title]));
  return [
    { id: "created", at: contract.created_at, label: "Contract created" },
    { id: "completed", at: contract.completed_at, label: "Contract completed" },
    ...events.filter((event) => names.has(event.milestone_id) && Object.hasOwn(milestoneStates, event.event_type === "created" ? "draft" : event.event_type))
      .map((event) => ({ id: `milestone-${event.id}`, at: event.created_at,
        label: `${names.get(event.milestone_id)} · ${event.event_type === "created" ? "Milestone created" : milestoneStates[event.event_type]}` }))
  ].filter((item) => item.at && Number.isFinite(Date.parse(item.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
