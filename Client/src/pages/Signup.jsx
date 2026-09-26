import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/authContext";
import { resendVerification } from "../services/authService";
import { getErrorMessage, getFieldErrors, getStatusCode } from "../utils/apiError";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_MIN_LENGTH = 6; // keep in sync with Server/src/utils/validation.js

const initialForm = { name: "", email: "", password: "", confirmPassword: "" };

/** Signup page (Part 2). New accounts are always created with the Viewer role. */
function Signup() {
  const { signup, isAuthenticated, isRestoring } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Part 2 - email verification: shown after a successful signup.
  const [signupResult, setSignupResult] = useState(null);
  const [resendState, setResendState] = useState({ status: "idle", message: "", devUrl: "" });

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

  // Part 2 - email verification step after a successful signup.
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

          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleResendVerification}
            disabled={resendState.status === "sending"}
          >
            {resendState.status === "sending" ? "Sending..." : "Resend verification email"}
          </button>

          {resendState.message && (
            <p className={resendState.status === "error" ? "alert alert--error" : "alert alert--success"}>
              {resendState.message}
            </p>
          )}

          {resendState.devUrl && (
            <p className="auth-card__note">
              Dev mode - <a href={resendState.devUrl}>open your new verification link</a>.
            </p>
          )}

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
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Create account</h1>
        <p className="auth-card__subtitle">New accounts start with the Viewer role</p>

        {formError && <p className="alert alert--error">{formError}</p>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="form-field" htmlFor="signup-name">
            <span className="form-field__label">Name</span>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your full name"
              disabled={isSubmitting}
            />
            {errors.name && <span className="form-field__error">{errors.name}</span>}
          </label>

          <label className="form-field" htmlFor="signup-email">
            <span className="form-field__label">Email</span>
            <input
              id="signup-email"
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

          <label className="form-field" htmlFor="signup-password">
            <span className="form-field__label">Password</span>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
              disabled={isSubmitting}
            />
            {errors.password && <span className="form-field__error">{errors.password}</span>}
          </label>

          <label className="form-field" htmlFor="signup-confirm-password">
            <span className="form-field__label">Confirm password</span>
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              disabled={isSubmitting}
            />
            {errors.confirmPassword && (
              <span className="form-field__error">{errors.confirmPassword}</span>
            )}
          </label>

          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-card__footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
