import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

function Login() {
  const navigate = useNavigate();

  const [savedEmail] = useState(() => localStorage.getItem("TechKarvo_remembered_email"));
  const [email, setEmail] = useState(savedEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(Boolean(savedEmail));
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const result = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (result.error) {
        alert(result.error.message);
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
        alert("Your account profile could not be verified. Please try again or contact support.");
        return;
      }

      if (rememberMe) {
        localStorage.setItem("TechKarvo_remembered_email", cleanEmail);
      } else {
        localStorage.removeItem("TechKarvo_remembered_email");
      }

      navigate(accountType === "freelancer" ? "/freelancer-dashboard" : "/client-dashboard");
    } catch (error) {
      alert("Login failed: " + error.message);
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

        <form onSubmit={handleLogin}>
          <label>Email Address</label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />

          <label>Password</label>

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="password-toggle"
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
