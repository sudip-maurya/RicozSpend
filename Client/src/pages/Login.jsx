import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import api from "../api/client";
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
  // Part 2 - email verification feedback + resend
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendState, setResendState] = useState({ status: "idle", message: "", devUrl: "" });

  // Where to go after login (set by ProtectedRoute when a page was blocked).
  const redirectTo = location.state?.from || "/dashboard";

  // Wake a sleeping Render service without changing the Login UI.
  useEffect(() => {
    api.get("/api/health").catch(() => {});
  }, []);

  if (isRestoring) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card--loading" role="status">
          Restoring your session...
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setNeedsVerification(false);

    if (!validate()) return;

    setIsSubmitting(true);

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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Log in</h1>
        <p className="auth-card__subtitle">Access your RicozSpend account</p>

        {successMessage && <p className="alert alert--success">{successMessage}</p>}
        {formError && <p className="alert alert--error">{formError}</p>}

        {needsVerification && (
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
                Dev mode - <a href={resendState.devUrl}>open your verification link</a>.
              </p>
            )}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="form-field" htmlFor="login-email">
            <span className="form-field__label">Email</span>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              disabled={isSubmitting}
            />
            {errors.email && <span className="form-field__error">{errors.email}</span>}
          </label>

          <label className="form-field" htmlFor="login-password">
            <span className="form-field__label">Password</span>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="Your password"
              disabled={isSubmitting}
            />
            {errors.password && <span className="form-field__error">{errors.password}</span>}
          </label>

          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="auth-card__footer">
          Don&apos;t have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;

