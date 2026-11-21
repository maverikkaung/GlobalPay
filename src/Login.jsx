import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { getAuthErrorMessage } from "./auth-errors.js";

const REMEMBERED_EMAIL_KEY = "TechKarvo_remembered_email";

function readRememberedEmail() {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [savedEmail] = useState(readRememberedEmail);
  const [email, setEmail] = useState(savedEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(Boolean(savedEmail));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    try {
      const result = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (result.error) {
        setError(getAuthErrorMessage("Login", result.error));
        return;
      }

      const authUser = result.data.user;
      const profileResult = await supabase.from("profiles")
        .select("full_name, account_type").eq("id", authUser.id).maybeSingle();
      const profile = profileResult.data;

      if (profileResult.error) {
        console.error("Profile lookup failed after login:", profileResult.error.message);
      }

      const accountType = profile?.account_type;

      if (accountType !== "freelancer" && accountType !== "client") {
        await supabase.auth.signOut();
        setError("Your account profile could not be verified. Please try again or contact support.");
        return;
      }

      try {
        if (rememberMe) localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch {
        // The remembered email is optional on browsers with restricted storage.
      }

      const returnLocation = location.state?.from;
      const returnPath = typeof returnLocation === "string"
        ? returnLocation
        : returnLocation && typeof returnLocation.pathname === "string"
          ? returnLocation.pathname + (returnLocation.search || "") + (returnLocation.hash || "")
          : null;
      const safeReturnPath = returnPath?.startsWith("/") && !returnPath.startsWith("//")
        ? returnPath
        : null;
      navigate(safeReturnPath || (accountType === "freelancer" ? "/freelancer-dashboard" : "/client-dashboard"));
    } catch (error) {
      setError(getAuthErrorMessage("Login", error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <h1>TechKarvo</h1>
        <h2>Welcome Back</h2>
        <p>Login to your TechKarvo account</p>

        {location.state?.notice && <p className="auth-notice auth-notice--success" role="status">{location.state.notice}</p>}
        {error && <p className="auth-notice auth-notice--error" role="alert">{error}</p>}

        <form onSubmit={handleLogin}>
          <label htmlFor="login-email">Email Address</label>

          <input
            type="email"
            id="login-email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />

          <label htmlFor="login-password">Password</label>

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              id="login-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          <div className="login-options">
            <label>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Remember me
            </label>

            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="login-footer">
          Don't have an account?
          <Link to="/signup"> Sign Up</Link>
        </div>

      </div>
    </div>
  );
}

export default Login;
