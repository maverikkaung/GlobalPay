const NETWORK_FAILURE = /failed to fetch|networkerror|network request failed|load failed|err_connection_(?:timed_out|reset|refused|closed)/i;

export function getAuthErrorMessage(action, error) {
  const message = typeof error === "string" ? error : error?.message;

  if (typeof message === "string" && NETWORK_FAILURE.test(message)) {
    return "TechKarvo could not reach the authentication service. Check your internet or network settings and try again.";
  }

  return `${action} failed: ${message || "Please try again."}`;
}
