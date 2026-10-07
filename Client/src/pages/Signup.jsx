import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import Logo from "../components/Logo";
import { useAuth } from "../context/authContext";
import { resendVerification } from "../services/authService";
import { getErrorMessage, getFieldErrors, getStatusCode } from "../utils/apiError";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN_LENGTH = 6; // keep in sync with Server/src/utils/validation.js

const BENEFITS = [
  {
    title: "See every rupee",
    description: "Track spending by vendor, department and category in one place.",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 3h12" />
        <path d="M6 8h12" />
        <path d="m6 13 8.5 8" />
        <path d="M6 13h3a4 4 0 0 0 0-8" />
      </svg>
    ),
  },
  {
    title: "Never overshoot budgets",
    description: "Smart alerts warn you before limits are crossed.",
    icon: (
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
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    title: "Decide with data",
    description: "Budget vs actual, trends and vendor insights at a glance.",
    icon: (
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
    ),
  },
  {
    title: "Reports in one click",
    description: "Export clean summaries for reviews and audits.",
    icon: (
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
    ),
  },
];

const initialForm = { name: "", email: "", password: "", confirmPassword: "" };

/** Signup page. New accounts are always created with the Viewer role. */
function Signup() {
  const { signup, isAuthenticated, isRestoring } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Email verification: shown after a successful signup.
  const [signupResult, setSignupResult] = useState(null);
  const [resendState, setResendState] = useState({ status: "idle", message: "", devUrl: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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
    return <Navigate to="/dashboard" replace />;
  }

  const handleResendVerification = async () => {
    setResendState({ status: "sending", message: "", devUrl: "" });

    try {
      const { data } = await resendVerification(signupResult.email);

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

  const handleOAuthClick = (provider) => {
    // TODO: Implement OAuth login flow for provider
    setToastMessage(`${provider} sign-up is coming soon.`);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  // Email verification step after a successful signup.
  if (signupResult) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-card__title">Check your email</h1>
          <p className="auth-card__subtitle">One more step before you can log in</p>

          <p className="alert alert--success">{signupResult.message}</p>

          <p className="auth-card__note">
            We sent a verification link to <strong>{signupResult.email}</strong>
            {signupResult.verification?.expiresIn
              ? ` - it expires in ${signupResult.verification.expiresIn}.`
              : "."}{" "}
            Open it to activate your account, then log in.
          </p>

          {signupResult.verification?.deliveryMode === "console" && (
            <p className="auth-card__note">
              Dev mode: no SMTP is configured, so the verification link is also printed in the
              backend console.
            </p>
          )}

          {signupResult.verification?.devVerificationUrl && (
            <p className="auth-card__note">
              Dev mode -{" "}
              <a href={signupResult.verification.devVerificationUrl}>verify this account now</a>.
            </p>
          )}

          <div className="auth-card__block">
            <button
              type="button"
              className="btn btn--ghost"
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
                Dev mode - <a href={resendState.devUrl}>open your new verification link</a>.
              </p>
            )}
          </div>

          <p className="auth-card__footer">
            Email already verified? <Link to="/login">Go to Login</Link>
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const validate = () => {
    const nextErrors = {};
    const name = form.name.trim();
    const email = form.email.trim();

    if (!name) {
      nextErrors.name = "Name is required.";
    } else if (name.length < 2) {
      nextErrors.name = "Name must be at least 2 characters long.";
    }

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!form.password) {
      nextErrors.password = "Password is required.";
    } else if (form.password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
    }

    if (!form.confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // No role is ever sent: the backend always creates a Viewer.
      const data = await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      // Verification disabled on the server -> keep the original flow.
      if (data?.emailVerification?.required === false) {
        navigate("/login", {
          replace: true,
          state: {
            message: data?.message || "Account created successfully. Please log in.",
            email: form.email.trim(),
          },
        });
        return;
      }

      // Otherwise show the "check your email" step before logging in.
      setSignupResult({
        message: data?.message || "Account created successfully. Please check your email.",
        email: form.email.trim(),
        verification: data?.emailVerification || {},
      });
    } catch (error) {
      const status = getStatusCode(error);

      if (status === 409) {
        setErrors(getFieldErrors(error));
        setFormError("An account with this email already exists.");
      } else if (status === 400) {
        setErrors(getFieldErrors(error));
        setFormError(getErrorMessage(error, "Please check the highlighted fields."));
      } else {
        setFormError(
          getErrorMessage(error, "Unable to create your account right now. Please try again.")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page signup-split-page">
      {/* LEFT PANEL (red gradient, white text) */}
      <div className="signup-left-panel">
        <div className="auth-panel-brand-bar">
          <Logo to="/" size="lg" className="auth-brand-pill" />
        </div>

        {/* CENTER CARDS CONTENT */}
        <div className="signup-left-content">
          <p className="rsu-kicker">Why RicozSpend?</p>
          <h2 className="rsu-headline">Take control of business spending.</h2>

          <div className="signup-cards">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="login-card signup-card">
                <div className="login-card__icon" aria-hidden="true">
                  {benefit.icon}
                </div>
                <h3 className="login-card__title">{benefit.title}</h3>
                <p className="login-card__desc">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL (form centered in white card) */}
      <div className="login-right-panel">
        <div
          className="login-card-wrapper"
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow:
              "0 10px 30px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)",
            border: "1px solid #f0f0f3",
            padding: "clamp(18px, 2.5vh, 28px) clamp(20px, 3vw, 32px)",
            width: "100%",
            maxWidth: "440px",
            boxSizing: "border-box",
            margin: "0 auto",
          }}
        >
          <div className="login-form-container" style={{ maxWidth: "100%" }}>
            <h1 className="login-title">Create account</h1>
            <p className="login-subtitle">New accounts start with the Viewer role</p>

          {formError && <p className="alert alert--error">{formError}</p>}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field" htmlFor="signup-name">
              <span className="login-field__label">Name</span>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Your full name"
                disabled={isSubmitting}
                className="login-input"
              />
              {errors.name && <span className="login-field__error">{errors.name}</span>}
            </label>

            <label className="login-field" htmlFor="signup-email">
              <span className="login-field__label">Email</span>
              <input
                id="signup-email"
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

            <label className="login-field" htmlFor="signup-password">
              <span className="login-field__label">Password</span>
              <div className="login-input-group">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
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

            <label className="login-field" htmlFor="signup-confirm-password">
              <span className="login-field__label">Confirm password</span>
              <div className="login-input-group">
                <input
                  id="signup-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  disabled={isSubmitting}
                  className="login-input login-input--password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
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
              {errors.confirmPassword && (
                <span className="login-field__error">{errors.confirmPassword}</span>
              )}
            </label>

            <button type="submit" className="login-btn login-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>
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
            Already have an account?{" "}
            <Link to="/login" className="login-link">
              Log in
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

export default Signup;
