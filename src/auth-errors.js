const NETWORK_FAILURE = /failed to fetch|networkerror|network request failed|load failed|err_connection_(?:timed_out|reset|refused|closed)/i;

export function getAuthErrorMessage(action, error) {
  const message = typeof error === "string" ? error : error?.message;

  if (typeof message === "string" && NETWORK_FAILURE.test(message)) {
    return "TechKarvo could not reach the authentication service. Check your internet or network settings and try again.";
  }

  switch (error?.code) {
    case "invalid_credentials":
    case "email_not_confirmed":
      return "Login failed. Check your email and password and make sure your email is confirmed.";
    case "weak_password":
      return "Choose a stronger password and try again.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many authentication requests. Wait a moment and try again.";
    default:
      return `${action} failed: Please try again.`;
  }
}
