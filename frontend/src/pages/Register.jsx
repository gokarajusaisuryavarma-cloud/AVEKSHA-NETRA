import { useState } from "react";
import { authApi } from "../api";
import "./Register.css";

function Register({ onRegister, onBack, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleRegister = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);

    // Client-side validations
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError({
        code: "VALIDATION ERROR",
        message: "Please enter an operator username.",
      });
      return;
    }

    if (cleanUsername.length < 3) {
      setError({
        code: "VALIDATION ERROR",
        message: "Operator username must contain at least 3 characters.",
      });
      return;
    }

    if (!password) {
      setError({
        code: "VALIDATION ERROR",
        message: "Please enter a secure password.",
      });
      return;
    }

    if (password.length < 6) {
      setError({
        code: "VALIDATION ERROR",
        message: "Password must contain at least 6 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setError({
        code: "PASSWORD MISMATCH",
        message: "Passwords do not match. Please verify and re-enter.",
      });
      return;
    }

    setLoading(true);

    try {
      const data = await authApi.register({
        username: cleanUsername,
        password: password,
      });

      console.log("Registration successful:", data);

      setSuccess({
        title: "OPERATOR REGISTERED",
        message: `Account '${cleanUsername}' created successfully. Redirecting to login...`,
      });

      setUsername("");
      setPassword("");
      setConfirmPassword("");

      // Automatically transition to login page after 1.2s
      setTimeout(() => {
        if (onRegister) {
          onRegister();
        } else if (onLogin) {
          onLogin();
        }
      }, 1200);
    } catch (err) {
      console.error("Registration error:", err);

      const status = err?.status;
      const rawMsg = String(err?.message || "").toLowerCase();
      const detailMsg = String(err?.data?.detail || "").toLowerCase();

      if (
        err?.isNetworkError ||
        !status ||
        rawMsg.includes("failed to fetch") ||
        rawMsg.includes("network") ||
        rawMsg.includes("unavailable") ||
        rawMsg.includes("connection")
      ) {
        setError({
          code: "CONNECTION ERROR",
          message: "Authentication service unavailable.",
          subtext: "Please verify that the backend server is running and accessible.",
        });
      } else if (
        status === 400 &&
        (rawMsg.includes("already exists") || detailMsg.includes("already exists"))
      ) {
        setError({
          code: "ACCOUNT EXISTS",
          message: `Username '${cleanUsername}' is already registered.`,
          subtext: "Please choose a different operator ID or login with existing credentials.",
        });
      } else {
        setError({
          code: "REGISTRATION FAILED",
          message: err?.message || "Unable to complete operator registration. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      {/* Background with tactical overlay */}
      <div className="register-background">
        <div className="tactical-grid-bg"></div>
        <div className="tactical-radial-glow"></div>
      </div>

      <div className="register-container">
        {/* Back button */}
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          disabled={loading}
        >
          ← BACK TO MAIN
        </button>

        {/* Brand header */}
        <div className="register-header">
          <div className="register-mark">AN</div>
          <h1>AVEKSHA</h1>
          <div className="register-subtitle">NETRA</div>
          <p>INTELLIGENT SURVEILLANCE PLATFORM</p>
        </div>

        {/* Register Card */}
        <div className="register-card">
          <div className="register-card-header">
            <div>
              <span className="register-section-label">PERSONNEL ENROLLMENT</span>
              <h2>CREATE OPERATOR ACCOUNT</h2>
            </div>
            <div className="secure-indicator">
              <span className="secure-dot"></span>
              SECURE ACCESS
            </div>
          </div>

          <div className="register-divider"></div>

          {/* Form */}
          <form className="register-form" onSubmit={handleRegister}>
            {/* Operator Username */}
            <div className="input-group">
              <label htmlFor="register-username">OPERATOR USERNAME</label>
              <div className="input-wrapper">
                <span className="input-icon">◉</span>
                <input
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. operator_delta"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="input-group">
              <label htmlFor="register-password">PASSWORD</label>
              <div className="input-wrapper">
                <span className="input-icon">◆</span>
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="input-group">
              <label htmlFor="confirm-password">CONFIRM PASSWORD</label>
              <div className="input-wrapper">
                <span className="input-icon">◆</span>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="register-error" role="alert">
                <div className="register-error-badge">
                  <span className="error-icon">⚠</span>
                  <span>[ {error.code || "REGISTRATION ERROR"} ]</span>
                </div>
                <div className="register-error-text">
                  {error.message || error}
                </div>
                {error.subtext && (
                  <div className="register-error-subtext">
                    {error.subtext}
                  </div>
                )}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="register-success" role="status">
                <div className="register-success-badge">
                  <span>✓</span>
                  <span>[ {success.title || "SUCCESS"} ]</span>
                </div>
                <div className="register-success-text">
                  {success.message}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="register-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  CREATING ACCOUNT...
                </>
              ) : (
                <>
                  CREATE OPERATOR ACCOUNT
                  <span className="button-arrow">→</span>
                </>
              )}
            </button>
          </form>

          {/* Switch to Login Link */}
          <div className="login-link-container">
            <span>ALREADY REGISTERED?</span>
            <button
              type="button"
              className="login-link"
              onClick={onLogin || onRegister}
              disabled={loading}
            >
              OPERATOR LOGIN →
            </button>
          </div>

          {/* Security Info */}
          <div className="security-info">
            <div className="security-row">
              <span className="security-icon">✓</span>
              <span>ROLE-BASED AUTHORIZATION & RBAC ENFORCEMENT</span>
            </div>
            <div className="security-row">
              <span className="security-icon">✓</span>
              <span>SHA-256 ENCRYPTED CREDENTIAL STORAGE</span>
            </div>
          </div>
        </div>

        {/* Tactical Status Banner */}
        <div className="register-system-status">
          <span className="system-status-dot"></span>
          AVEKSHA NETRA NODE
          <span className="status-divider">|</span>
          DEFENSE LEVEL 4 ENCRYPTION
        </div>

        {/* Footer */}
        <div className="register-footer">
          <span>AVEKSHA NETRA</span>
          <span>•</span>
          <span>INTELLIGENT SURVEILLANCE PLATFORM</span>
          <span>•</span>
          <span>v2.4</span>
        </div>
      </div>
    </div>
  );
}

export default Register;