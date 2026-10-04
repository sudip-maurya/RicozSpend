import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import api from "../api/client";
import Logo from "../components/Logo";
import { useAuth } from "../context/authContext";
import { resendVerification } from "../services/authService";
import { getErrorMessage, getFieldErrors, getStatusCode } from "../utils/apiError";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Login page (Part 2) - replaces the Part 1 placeholder. */
function Login() {
  const { login, isAuthenticated, isRestoring } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: location.state?.email || "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [successMessage] = useState(location.state?.message || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSlowResponse, setIsSlowResponse] = useState(false);
  const slowTimerRef = useRef(null);
  // Part 2 - email verification feedback + resend
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState({ status: "idle", message: "", devUrl: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Where to go after login (set by ProtectedRoute when a page was blocked).
  const redirectTo = location.state?.from || "/dashboard";

  // Wake a sleeping Render service without changing the Login UI.
  useEffect(() => {
    api.get("/api/health").catch(() => {});
  }, []);

  const handleOAuthClick = (provider) => {
    // TODO: Implement OAuth login flow for provider
    setToastMessage(`${provider} sign-in is coming soon.`);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  if (isRestoring) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--loading" role="status">
          <div className="auth-spinner" aria-hidden="true" />
          <span>Restoring your session...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const validate = () => {
    const nextErrors = {};
    const email = form.email.trim();

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!form.password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleResendVerification = async () => {
    setResendState({ status: "sending", message: "", devUrl: "" });

    try {
      const { data } = await resendVerification(form.email.trim());

      setResendState({
        status: "sent",
        message: data?.message || "A new verification email has been sent.",
        devUrl: data?.devVerificationUrl || "",
      });
    } catch (error) {
      setResendState({
        status: "error",
        message: getErrorMessage(error, "Unable to resend the email right now. Please try again."),
        devUrl: "",
      });
    }
  };

  useEffect(() => {
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setNeedsVerification(false);
    setIsSlowResponse(false);

    if (!validate()) return;

    setIsSubmitting(true);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      setIsSlowResponse(true);
    }, 5500);

    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const status = getStatusCode(error);
      const errorCode = error?.response?.data?.code;

      if (status === 401) {
        setFormError("Invalid email or password");
      } else if (status === 403 && errorCode === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setFormError(getErrorMessage(error, "Please verify your email address before logging in."));
      } else if (status === 403 && errorCode === "ACCOUNT_DEACTIVATED") {
        setFormError(getErrorMessage(error, "Your account has been deactivated."));
      } else if (status === 400) {
        setErrors(getFieldErrors(error));
        setFormError(getErrorMessage(error, "Please check your email and password."));
      } else {
        setFormError(getErrorMessage(error, "Unable to log in right now. Please try again."));
      }
    } finally {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      setIsSlowResponse(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page login-split-page">
      {/* LEFT PANEL (red gradient, white text) */}
      <div className="login-left-panel">
        <div className="auth-panel-brand-bar">
          <Logo to="/" size="lg" className="auth-brand-pill" />
        </div>

        <div className="login-left-content">
          <h2 className="login-hero-title">
            Smart Business
            <br />
            and Spend Analysis
          </h2>
          <p className="login-hero-subtitle">
            Turn your spending data into clear insights across vendors, categories,
            departments, and employees.
          </p>

          <div className="login-cards">
            <div className="login-card">
              <div className="login-card__icon" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="20" height="14" x="2" y="5" rx="3" />
                  <path d="M16 12h.01" />
                  <path d="M2 10h20" />
                </svg>
              </div>
              <h3 className="login-card__title">Manage expense</h3>
              <p className="login-card__desc">
                Encourages consistency through consecutive completions.
              </p>
            </div>

            <div className="login-card">
              <div className="login-card__icon" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h3 className="login-card__title">Analysis</h3>
              <p className="login-card__desc">
                Analyze spending by vendor, category, department, employee, and time.
              </p>
            </div>

            <div className="login-card">
              <div className="login-card__icon" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 className="login-card__title">Reports</h3>
              <p className="login-card__desc">
                Use charts, filters, search, and exportable reports for insights.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL (white, form centered) */}
      <div className="login-right-panel">
        <div
          className="login-card-wrapper"
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow:
              "0 10px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)",
            border: "1px solid #f0f0f3",
            padding: "clamp(24px, 4vw, 32px)",
            width: "100%",
            maxWidth: "440px",
            boxSizing: "border-box",
            margin: "0 auto",
          }}
        >
          <div className="login-form-container" style={{ maxWidth: "100%" }}>
            <h1 className="login-title">Login</h1>
            <p className="login-subtitle">Access your RicozSpend account</p>

          {successMessage && <p className="alert alert--success">{successMessage}</p>}
          {formError && <p className="alert alert--error">{formError}</p>}

          {needsVerification && (
            <div className="login-verification-block">
              <button
                type="button"
                className="btn btn--ghost login-btn--ghost"
                onClick={handleResendVerification}
                disabled={resendState.status === "sending"}
              >
                {resendState.status === "sending" ? "Sending..." : "Resend verification email"}
              </button>

              {resendState.message && (
                <p
                  className={
                    resendState.status === "error" ? "alert alert--error" : "alert alert--success"
                  }
                >
                  {resendState.message}
                </p>
              )}

              {resendState.devUrl && (
                <p className="auth-card__note">
                  Dev mode - <a href={resendState.devUrl}>open your verification link</a>.
                </p>
              )}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field" htmlFor="login-email">
              <span className="login-field__label">Email</span>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@company.com"
                disabled={isSubmitting}
                className="login-input"
              />
              {errors.email && <span className="login-field__error">{errors.email}</span>}
            </label>

            <label className="login-field" htmlFor="login-password">
              <span className="login-field__label">Password</span>
              <div className="login-input-group">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 6 characters"
                  disabled={isSubmitting}
                  className="login-input login-input--password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <span className="login-field__error">{errors.password}</span>}
            </label>

            <button
              type="submit"
              className={`login-btn login-btn--primary ${isSubmitting ? "login-btn--loading" : ""}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  <span>Logging in…</span>
                </>
              ) : (
                "Login"
              )}
            </button>
            {isSubmitting && isSlowResponse && (
              <p className="login-slow-hint" role="status">
                Server is waking up, please wait…
              </p>
            )}
          </form>

          <div className="login-divider">
            <span>or</span>
          </div>

          <div className="login-oauth-group">
            <button
              type="button"
              className="login-oauth-btn"
              onClick={() => handleOAuthClick("Google")}
            >
              <svg className="login-oauth-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Sign up with Google</span>
            </button>

            <button
              type="button"
              className="login-oauth-btn"
              onClick={() => handleOAuthClick("Apple")}
            >
              <svg
                className="login-oauth-icon login-oauth-icon--apple"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.6-.74 1.01-1.76.9-2.78-.88.04-1.95.59-2.58 1.33-.56.64-1.05 1.68-.92 2.68 1 .08 2-.49 2.6-1.23z" />
              </svg>
              <span>Sign up with Apple</span>
            </button>
          </div>

          <p className="login-footer">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="login-link">
              Create one
            </Link>
          </p>
        </div>
      </div>

        {toastMessage && (
          <div className="login-toast" role="status" aria-live="polite">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;

