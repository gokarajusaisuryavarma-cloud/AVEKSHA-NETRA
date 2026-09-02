import { useState } from "react";
import "./Register.css";

function Register({ onRegister, onBack }) {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (event) => {

    event.preventDefault();

    setError("");
    setSuccess("");

    // ==============================
    // VALIDATION
    // ==============================

    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }

    if (username.trim().length < 3) {
      setError("Username must contain at least 3 characters.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // ==============================
    // REGISTER API
    // ==============================

    try {

      const response = await fetch(
        "http://127.0.0.1:8000/api/auth/register",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            username: username.trim(),
            password: password
          })
        }
      );

      const data = await response.json();

      // ==============================
      // API ERROR
      // ==============================

      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Registration failed. Please try again."
        );

      }

      // ==============================
      // SUCCESS
      // ==============================

      console.log(
        "Registration successful:",
        data
      );

      setSuccess(
        "Registration successful. Redirecting to login..."
      );

      setUsername("");
      setPassword("");
      setConfirmPassword("");

      // Give the user a moment to see success
      setTimeout(() => {

        if (onRegister) {
          onRegister();
        }

      }, 1000);

    } catch (err) {

      console.error(
        "Registration error:",
        err
      );

      if (
        err instanceof TypeError &&
        err.message === "Failed to fetch"
      ) {

        setError(
          "Unable to connect to AVEKSHA NETRA server. " +
          "Please make sure the backend is running."
        );

      } else {

        setError(
          err.message ||
          "Registration failed. Please try again."
        );

      }

    } finally {

      setLoading(false);

    }

  };

  return (

    <div className="register-page">

      {/* ==============================
          BACKGROUND
      ============================== */}

      <div className="register-background">

        <div className="camouflage-pattern"></div>

        <div className="background-grid"></div>

        <div className="background-glow"></div>

      </div>


      {/* ==============================
          REGISTER CONTAINER
      ============================== */}

      <div className="register-container">

        <button
          type="button"
          className="back-button"
          onClick={onBack}
          disabled={loading}
        >
          ← BACK TO MAIN
        </button>


        {/* ==============================
            BRAND
        ============================== */}

        <div className="register-header">

          <div className="register-mark">
            AN
          </div>

          <h1>
            AVEKSHA
          </h1>

          <div className="register-subtitle">
            NETRA
          </div>

          <p>
            INTELLIGENT SURVEILLANCE PLATFORM
          </p>

        </div>


        {/* ==============================
            REGISTER CARD
        ============================== */}

        <div className="register-card">

          <div className="register-card-header">

            <div>

              <span className="register-section-label">
                OPERATOR ACCESS
              </span>

              <h2>
                CREATE ACCOUNT
              </h2>

            </div>

            <div className="secure-indicator">

              <span className="secure-dot"></span>

              SECURE

            </div>

          </div>


          <div className="register-divider"></div>


          {/* ==============================
              FORM
          ============================== */}

          <form
            className="register-form"
            onSubmit={handleRegister}
          >

            {/* USERNAME */}

            <div className="input-group">

              <label htmlFor="register-username">
                OPERATOR ID
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  ◉
                </span>

                <input
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Create operator ID"
                  autoComplete="username"
                  disabled={loading}
                />

              </div>

            </div>


            {/* PASSWORD */}

            <div className="input-group">

              <label htmlFor="register-password">
                PASSWORD
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  ◆
                </span>

                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Create secure password"
                  autoComplete="new-password"
                  disabled={loading}
                />

              </div>

            </div>


            {/* CONFIRM PASSWORD */}

            <div className="input-group">

              <label htmlFor="confirm-password">
                CONFIRM PASSWORD
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  ◆
                </span>

                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Confirm secure password"
                  autoComplete="new-password"
                  disabled={loading}
                />

              </div>

            </div>


            {/* ERROR */}

            {error && (

              <div className="register-error">

                <span className="error-icon">
                  ⚠
                </span>

                <div>

                  <strong>
                    REGISTRATION FAILED
                  </strong>

                  <span>
                    {error}
                  </span>

                </div>

              </div>

            )}


            {/* SUCCESS */}

            {success && (

              <div className="register-success">

                <span>
                  ✓
                </span>

                <div>

                  <strong>
                    ACCOUNT CREATED
                  </strong>

                  <span>
                    {success}
                  </span>

                </div>

              </div>

            )}


            {/* SUBMIT */}

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
                  <span className="button-arrow">
                    →
                  </span>
                </>

              )}

            </button>

          </form>


          {/* SECURITY */}

          <div className="security-info">

            <div className="security-row">

              <span className="security-icon">
                ✓
              </span>

              <span>
                SECURE ACCOUNT CREATION
              </span>

            </div>

            <div className="security-row">

              <span className="security-icon">
                ✓
              </span>

              <span>
                AUTHORIZED PERSONNEL ONLY
              </span>

            </div>

          </div>

        </div>


        {/* SYSTEM STATUS */}

        <div className="register-system-status">

          <span className="system-status-dot"></span>

          AVEKSHA NETRA SYSTEM

          <span className="status-divider">
            |
          </span>

          SECURE CONNECTION

        </div>


        {/* FOOTER */}

        <div className="register-footer">

          <span>
            AVEKSHA NETRA
          </span>

          <span>
            •
          </span>

          <span>
            COMMAND & SURVEILLANCE SYSTEM
          </span>

          <span>
            •
          </span>

          <span>
            v1.0.0
          </span>

        </div>

      </div>

    </div>

  );
}

export default Register;