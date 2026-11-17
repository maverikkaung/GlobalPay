import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { getAuthErrorMessage } from "./auth-errors.js";

function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState("Freelancer");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      const result = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          emailRedirectTo: window.location.origin + "/login",
          data: {
            full_name: cleanName,
            account_type: accountType.toLowerCase()
          }
        }
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (result.data.session) {
        navigate(accountType === "Freelancer" ? "/freelancer-dashboard" : "/client-dashboard", { replace: true });
      } else {
        navigate("/login", {
          replace: true,
          state: { notice: "Your account was created. Check your email to confirm your address before logging in." }
        });
      }

    } catch (error) {
      setError(getAuthErrorMessage("Signup", error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>TechKarvo</h1>
        <h2>Create Account</h2>
        <p>Join TechKarvo and start your global journey.</p>

        <form onSubmit={handleSignup}>
          {error && <p className="auth-notice auth-notice--error" role="alert">{error}</p>}

          <label htmlFor="signup-name">Full Name</label>
          <input
            type="text"
            id="signup-name"
            placeholder="Enter your full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <label htmlFor="signup-email">Email Address</label>
          <input
            type="email"
            id="signup-email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="signup-password">Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              id="signup-password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
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

          <label htmlFor="signup-confirm-password">Confirm Password</label>
          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="signup-confirm-password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />

            <button
              type="button"
              className="password-toggle"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            >
              {showConfirmPassword ? "🙈" : "👁"}
            </button>
          </div>

          <div className="account-type-section">
            <p id="account-type-label">Choose Account Type</p>

            <div className="account-type-options" role="group" aria-labelledby="account-type-label">
               <button
                type="button"
                className={
                  "account-type-card " +
                  (accountType === "Freelancer" ? "selected" : "")
                }
                aria-pressed={accountType === "Freelancer"}
                onClick={() => setAccountType("Freelancer")}
              >
                <span className="account-type-icon" aria-hidden="true">💻</span>
                <span className="account-type-title">Freelancer</span>
                <span className="account-type-description">Find jobs and earn money.</span>

                {accountType === "Freelancer" && (
                  <span className="account-check">✓</span>
                )}
              </button>

              <button
                type="button"
                className={
                  "account-type-card " +
                  (accountType === "Client" ? "selected" : "")
                }
                aria-pressed={accountType === "Client"}
                onClick={() => setAccountType("Client")}
              >
                <span className="account-type-icon" aria-hidden="true">🏢</span>
                <span className="account-type-title">Client</span>
                <span className="account-type-description">Hire talented freelancers.</span>

                {accountType === "Client" && (
                  <span className="account-check">✓</span>
                )}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="login-footer">
          Already have an account?
          <Link to="/login"> Login</Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
