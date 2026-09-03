import { useState } from "react";
import "./Login.css";

function Login({ onLogin, onBack, onRegister }) {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (event) => {

        event.preventDefault();

        setError("");

        if (!username.trim() || !password) {

            setError(
                "Please enter username and password."
            );

            return;
        }

        setLoading(true);

        try {

            const response = await fetch(
                "https://aveksha-netra-backend.onrender.com/api/auth/login",
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

            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Invalid username or password"
                );
            }

            // ==================================================
            // STORE AUTHENTICATION INFORMATION
            // ==================================================

            localStorage.setItem(
                "aveksha_token",
                data.access_token
            );

            localStorage.setItem(
                "aveksha_user",
                JSON.stringify(data.user)
            );

            // ==================================================
            // OPEN DASHBOARD
            // ==================================================

            onLogin(data.user);

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            setError(
                error.message ||
                "Unable to connect to server."
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="login-page">

            {/* ==================================================
                BACKGROUND
                ================================================== */}

            <div className="login-background">

                <div className="camouflage-pattern"></div>

            </div>


            {/* ==================================================
                LOGIN CONTAINER
                ================================================== */}

            <div className="login-container">


                {/* ==================================================
                    BACK BUTTON
                    ================================================== */}

                <button
                    type="button"
                    className="back-button"
                    onClick={onBack}
                    disabled={loading}
                >
                    ← BACK
                </button>


                {/* ==================================================
                    BRAND HEADER
                    ================================================== */}

                <div className="login-header">

                    <div className="login-mark">
                        AN
                    </div>

                    <h1>
                        AVEKSHA
                    </h1>

                    <div className="login-subtitle">
                        NETRA
                    </div>

                    <p>
                        SECURE COMMAND CENTER
                    </p>

                </div>


                {/* ==================================================
                    LOGIN FORM
                    ================================================== */}

                <form
                    className="login-form"
                    onSubmit={handleLogin}
                >

                    <div className="form-title">
                        OPERATOR LOGIN
                    </div>


                    <div className="form-line"></div>


                    {/* USERNAME */}

                    <label htmlFor="username">
                        USERNAME
                    </label>

                    <input
                        id="username"
                        type="text"
                        placeholder="Enter username"
                        value={username}
                        onChange={(event) =>
                            setUsername(event.target.value)
                        }
                        autoComplete="username"
                        disabled={loading}
                    />


                    {/* PASSWORD */}

                    <label htmlFor="password">
                        PASSWORD
                    </label>

                    <input
                        id="password"
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        autoComplete="current-password"
                        disabled={loading}
                    />


                    {/* ==================================================
                        ERROR MESSAGE
                        ================================================== */}

                    {error && (

                        <div className="login-error">
                            ⚠ {error}
                        </div>

                    )}


                    {/* ==================================================
                        LOGIN BUTTON
                        ================================================== */}

                    <button
                        className="login-submit"
                        type="submit"
                        disabled={loading}
                    >

                        {loading
                            ? "AUTHENTICATING..."
                            : "ACCESS COMMAND CENTER"
                        }

                    </button>

                </form>


                {/* ==================================================
                    REGISTER OPTION
                    ================================================== */}

                <div
                    className="register-link-container"
                >

                    <span>
                        NEW OPERATOR?
                    </span>

                    <button
                        type="button"
                        className="register-link"
                        onClick={onRegister}
                        disabled={loading}
                    >
                        CREATE ACCOUNT →
                    </button>

                </div>


                {/* ==================================================
                    SECURITY STATUS
                    ================================================== */}

                <div className="security-status">

                    <span className="status-dot"></span>

                    SECURE AUTHENTICATION SYSTEM

                </div>


                {/* ==================================================
                    FOOTER
                    ================================================== */}

                <div className="login-footer">

                    AVEKSHA NETRA •
                    INTELLIGENT SURVEILLANCE PLATFORM

                </div>


            </div>

        </div>

    );

}


export default Login;