const NETWORK_FAILURE = /failed to fetch|networkerror|network request failed|load failed|err_connection_(?:timed_out|reset|refused|closed)|timeout/i;

/** Turn request errors into useful messages without exposing database internals. */
export function getRequestErrorMessage(action, error) {
  const message = typeof error === "string" ? error : error?.message;

  if (typeof message === "string" && NETWORK_FAILURE.test(message)) {
    return `${action}. Check your connection and try again.`;
  }

  return `${action}. Please try again.`;
}
