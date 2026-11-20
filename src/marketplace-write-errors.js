const EXHAUSTED_CYCLE_CREDITS = "No usage credits remain in this simulated membership cycle";

export function getMarketplaceWriteError(error, action, roleLabel) {
  if (error?.code === "23514" && error?.message === EXHAUSTED_CYCLE_CREDITS) {
    return `Your monthly ${roleLabel} limit has been reached. Choose a plan with more monthly credits or wait for the next cycle.`;
  }
  return `${action}. Please try again.`;
}
