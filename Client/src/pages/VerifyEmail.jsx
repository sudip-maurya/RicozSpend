import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { resendVerification, verifyEmail } from "../services/authService";
import { getErrorMessage, getFieldErrors, getStatusCode } from "../utils/apiError";

const RESENDABLE_CODES = ["INVALID_VERIFICATION_TOKEN", "VERIFICATION_TOKEN_EXPIRED", "MISSING_VERIFICATION_TOKEN"];

/** /verify-email?token=... */
function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState(token ? "verifying" : "missing-token");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [resendState, setResendState] = useState({ status: "idle", message: "", devUrl: "" });

  const hasVerifiedRef = useRef(false);
  const prevTokenRef = useRef(token);

  useEffect(() => {
    if (!token) return undefined;

    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      hasVerifiedRef.current = false;
      setStatus("verifying");
    }

    if (hasVerifiedRef.current) return undefined;
    hasVerifiedRef.current = true;

    const run = async () => {
      try {
        const { data } = await verifyEmail(token);

        setStatus("success");
        setMessage(data?.message || "Email verified successfully.");
        setCode(data?.code || "");
      } catch (error) {
        setStatus("error");
        setMessage(getErrorMessage(error, "This verification link could not be used."));
        setCode(error?.response?.data?.code || "");
      }
    };

    run();
  }, [token]);

  const handleResend = useCallback(
    async (event) => {
      event.preventDefault();
      setResendState({ status: "sending", message: "", devUrl: "" });

      try {
        const { data } = await resendVerification(email.trim());

        setResendState({
          status: "sent",
          message: data?.message || "If an account needs verification, a new link has been sent.",
          devUrl: data?.devVerificationUrl || "",
        });
      } catch (error) {
        if (getStatusCode(error) === 429) {
          setResendState({ status: "error", message: getErrorMessage(error), devUrl: "" });
          return;
        }

        if (getStatusCode(error) === 400) {
          const fieldErrors = getFieldErrors(error);
          setResendState({
            status: "error",
            message: fieldErrors.email || getErrorMessage(error, "Please enter a valid email address."),
            devUrl: "",
          });
          return;
        }

        setResendState({
          status: "error",
          message: getErrorMessage(error, "Unable to resend the email right now. Please try again."),
          devUrl: "",
        });
      }
    },
    [email]
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Email verification</h1>
        <p className="auth-card__subtitle">Confirm your address to activate your account</p>

        {status === "verifying" && <p className="alert alert--info">Verifying your email address...</p>}

        {status === "success" && (
          <>
            <p className="alert alert--success">{message}</p>
            <Link className="btn btn--primary" to="/login">
              Go to Login
            </Link>
          </>
        )}

        {status === "missing-token" && (
          <p className="alert alert--error">
            This page needs a verification link. Open the link from your email, or request a new one
            below.
          </p>
        )}

        {status === "error" && <p className="alert alert--error">{message}</p>}

        {(status !== "success" && status !== "verifying") || RESENDABLE_CODES.includes(code) ? (
          <form className="auth-form" onSubmit={handleResend} noValidate>
            <label className="form-field" htmlFor="verify-email-address">
              <span className="form-field__label">Request a new verification email</span>
              <input
                id="verify-email-address"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                disabled={resendState.status === "sending"}
              />
            </label>

            <button type="submit" className="btn btn--primary" disabled={resendState.status === "sending"}>
              {resendState.status === "sending" ? "Sending..." : "Resend verification email"}
            </button>
          </form>
        ) : null}

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
            Dev mode (no SMTP configured) -{" "}
            <a href={resendState.devUrl}>open your new verification link</a>.
          </p>
        )}

        <p className="auth-card__footer">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;
