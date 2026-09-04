import { useState } from "react";
import { authApi } from "../api";
import "./Login.css";

function Login({ onLogin, onBack, onRegister }) {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (event) => {
        event.preventDefault();
        if (loading) return;

        setError(null);

        const cleanUsername = username.trim();
        if (!cleanUsername) {
            setError({
                code: "INPUT REQUIRED",
                message: "Please enter your operator username.",
            });
            return;
        }

        if (!password) {
            setError({
                code: "INPUT REQUIRED",
                message: "Please enter your password.",
            });
            return;
        }

        setLoading(true);

        try {
            const data = await authApi.login({
                username: cleanUsername,
                password: password,
            });

            // Store session
            authApi.saveSession(data.access_token, data.user);

            // Open command center
            onLogin(data.user);
        } catch (err) {
            console.error("Login attempt failed:", err);

            const status = err?.status;
            const rawMsg = String(err?.message || "").toLowerCase();
            const detailMsg = String(err?.data?.detail || "").toLowerCase();

            // Case 1: Backend unreachable / network failure
            if (
                err?.isNetworkError ||
                !status ||
                err?.name === "TypeError" ||
                rawMsg.includes("failed to fetch") ||
                rawMsg.includes("network") ||
                rawMsg.includes("unavailable") ||
                rawMsg.includes("connection")
            ) {
                setError({
                    code: "CONNECTION ERROR",
                    message: "Authentication service unavailable.",
                    subtext: "Please verify the backend connection and try again.",
                });
            } else if (
                status === 401 ||
                status === 403 ||
                rawMsg.includes("invalid") ||
                detailMsg.includes("invalid") ||
                detailMsg.includes("password") ||
                detailMsg.includes("user")
            ) {
                // Case 2: Invalid username or password
                setError({
                    code: "ACCESS DENIED",
                    message: "Invalid username or password.",
                });
            } else if (status >= 500) {
                // Case 3: Server internal error
                setError({
                    code: "SERVER ERROR",
                    message: "Unable to complete sign-in. Please try again.",
                });
            } else {
                // Default clean message
                setError({
                    code: "AUTHENTICATION NOTICE",
                    message: err?.message || "Unable to complete sign-in. Please try again.",
                });
            }
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
                        <div className="login-error" role="alert">
                            <div className="login-error-badge">
                                <span className="error-icon">⚠</span>
                                <span>[ {error.code || "AUTHENTICATION NOTICE"} ]</span>
                            </div>
                            <div className="login-error-text">
                                {error.message || error}
                            </div>
                            {error.subtext && (
                                <div className="login-error-subtext">
                                    {error.subtext}
                                </div>
                            )}
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