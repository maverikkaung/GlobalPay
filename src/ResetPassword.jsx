import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState("");

  async function handleUpdatePassword(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setUpdated(true);
    } catch (updateError) {
      setError("Unable to update your password. " + updateError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <h1>TechKarvo</h1>
        <h2>Reset Password</h2>

        {!updated ? (
          <>
            <p>Enter your new password below.</p>

            <form onSubmit={handleUpdatePassword}>
              {error && <p className="auth-notice auth-notice--error" role="alert">{error}</p>}
              <label htmlFor="new-password">New Password</label>

              <input
                type="password"
                id="new-password"
                placeholder="Enter new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />

              <label htmlFor="confirm-new-password">Confirm New Password</label>

              <input
                type="password"
                id="confirm-new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                minLength={6}
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h3>Password Updated!</h3>
            <p>Your password has been changed successfully.</p>

            <button type="button" onClick={handleContinue}>
              Continue to Login
            </button>
          </>
        )}

        <div className="login-footer">
          <Link to="/login">Back to Login</Link>
        </div>

      </div>
    </div>
  );
}

export default ResetPassword;
