import { useNavigate, Link } from "react-router-dom";
import "../css/login.css";
import { useState } from "react";
import { useAuth } from "../auth/authContext.jsx";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [user, setUser] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      await login({ email: user.email, password: user.password });
      navigate("/chatdashbord");
    } catch (error) {
      console.error(error);
      setErr(error.message || "Login failed");
    }
  };

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={handleLogin}>
        {/* Logo */}
        <div className="login-logo">
          <img src="./img-login.png" alt="Ping Logo" />
        </div>

        {/* App name + tagline */}
        <p className="login-subtitle">Connect. Chat. Anytime.</p>

        {/* Inputs */}
        <input
          className="login-input"
          type="text"
          placeholder="Username or Email"
          value={user.email}
          onChange={(e) => setUser((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          value={user.password}
          onChange={(e) => setUser((prev) => ({ ...prev, password: e.target.value }))}
          required
        />

        {/* Options row */}
        <div className="login-row">
          <label className="login-remember">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <a href="#" className="login-forgot">Forgot Password?</a>
        </div>

        {/* Login button */}
        <button className="login-btn" type="submit">Login</button>
        {err && <p className="login-error">{err}</p>}

        {/* Extra links */}
        <div className="login-links">
          <Link to="/signup">Create Account</Link>
          <a href="#">Login with Google/Facebook</a>
        </div>
      </form>
    </main>
  );
};

export default Login;
