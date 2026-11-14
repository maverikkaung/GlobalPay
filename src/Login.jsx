import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("TechKarvo_remembered_email");

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    const result = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (result.error) {
      alert(result.error.message);
      setLoading(false);
      return;
    }

    const user = result.data.user;

    const profileResult = await supabase
      .from("profiles")
      .select("full_name, account_type")
      .eq("id", user.id)
      .single();

    if (profileResult.error) {
      alert(
        "Login successful, but profile could not be loaded: " +
        profileResult.error.message
      );
      setLoading(false);
      return;
    }

    const profile = profileResult.data;
    const currentUser = {
  id: user.id,
  name: profile.full_name,
  email: cleanEmail,
  accountType:
    profile.account_type === "freelancer"
      ? "Freelancer"
      : "Client"
};

localStorage.setItem(
  "TechKarvo_current_user",
  JSON.stringify(currentUser)
);

    if (rememberMe) {
      localStorage.setItem(
        "TechKarvo_remembered_email",
        cleanEmail
      );
    } else {
      localStorage.removeItem("TechKarvo_remembered_email");
    }

    alert("Welcome back, " + profile.full_name + "!");

    setLoading(false);

    if (profile.account_type === "freelancer") {
      navigate("/freelancer-dashboard");
    } else if (profile.account_type === "client") {
      navigate("/client-dashboard");
    } else {
      navigate("/");
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