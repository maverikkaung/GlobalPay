import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase.js";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResetRequest(event) {
    event.preventDefault();

    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    const result = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      {
        redirectTo: window.location.origin + "/reset-password"
      }
    );

    setLoading(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="login-page">
      <div className="login-card">

        <h1>GlobalPay</h1>
        <h2>Forgot Password?</h2>

        {!sent ? (
          <>
            <p>
              Enter your email address and we will send you a password reset link.
            </p>

            <form onSubmit={handleResetRequest}>
              <label>Email Address</label>

              <input
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        ) : (
          <div>
            <h3>Check Your Email</h3>
            <p>
              If an account exists for this email, a password reset link has been sent.
            </p>
          </div>
        )}

        <div className="login-footer">
          <Link to="/login">Back to Login</Link>
        </div>

      </div>
    </div>
  );
}

export default ForgotPassword;