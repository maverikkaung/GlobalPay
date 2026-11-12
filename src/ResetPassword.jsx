import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  async function handleUpdatePassword(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const result = await supabase.auth.updateUser({
      password: password
    });

    setLoading(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setUpdated(true);
  }

  async function handleContinue() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <h1>GlobalPay</h1>
        <h2>Reset Password</h2>

        {!updated ? (
          <>
            <p>Enter your new password below.</p>

            <form onSubmit={handleUpdatePassword}>
              <label>New Password</label>

              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />

              <label>Confirm New Password</label>

              <input
                type="password"
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