import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

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

  async function handleSignup(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setLoading(true);

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
        alert(result.error.message);
        setLoading(false);
        return;
      }

      alert(
        "Account created successfully! Please check your email and confirm your account before logging in."
      );

      setLoading(false);
      navigate("/login");

    } catch (error) {
      alert("Signup failed: " + error.message);
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>GlobalPay</h1>
        <h2>Create Account</h2>
        <p>Join GlobalPay and start your global journey.</p>

        <form onSubmit={handleSignup}>
          <label>Full Name</label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <label>Email Address</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label>Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>

          <label>Confirm Password</label>
          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowConfirmPassword(!showConfirmPassword)
              }
            >
              {showConfirmPassword ? "🙈" : "👁"}
            </button>
          </div>

          <div className="account-type-section">
            <label>Choose Account Type</label>

            <div className="account-type-options">
               <div
                className={
                  "account-type-card " +
                  (accountType === "Freelancer" ? "selected" : "")
                }
                onClick={() => setAccountType("Freelancer")}
              >
                <div className="account-type-icon">💻</div>
                <h3>Freelancer</h3>
                <p>Find jobs and earn money.</p>

                {accountType === "Freelancer" && (
                  <span className="account-check">✓</span>
                )}
              </div>

              <div
                className={
                  "account-type-card " +
                  (accountType === "Client" ? "selected" : "")
                }
                onClick={() => setAccountType("Client")}
              >
                <div className="account-type-icon">🏢</div>
                <h3>Client</h3>
                <p>Hire talented freelancers.</p>

                {accountType === "Client" && (
                  <span className="account-check">✓</span>
                )}
              </div>
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