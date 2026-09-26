/**
 * Email delivery for verification links (Part 2 - email verification).
 *
 * If SMTP_HOST (plus optional SMTP_USER/SMTP_PASS) is configured in Server/.env
 * the mail is really sent with nodemailer. Otherwise the app runs in dev mode
 * and prints the verification link to the server console, so the flow can be
 * tested without a mail provider.
 */

const nodemailer = require("nodemailer");

const isSmtpConfigured = () => Boolean(process.env.SMTP_HOST);

const isTestMode = () =>
  String(process.env.NODE_ENV || "").toLowerCase() === "test";

const getMailFrom = () => process.env.MAIL_FROM || "RicozSpend <no-reply@ricozspend.local>";

const getTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

const buildVerificationEmail = ({ name, url, expiresInLabel }) => ({
  subject: "Verify your RicozSpend email address",
  text: [
    `Hi ${name},`,
    "",
    "Thanks for signing up for RicozSpend. Please confirm your email address to activate your account:",
    url,
    "",
    `This link expires in ${expiresInLabel}. If it expires you can request a new one from the login page.`,
    "",
    "If you did not create this account you can ignore this email.",
  ].join("\n"),
  html: `
    <p>Hi ${name},</p>
    <p>Thanks for signing up for <strong>RicozSpend</strong>. Please confirm your email address to activate your account:</p>
    <p><a href="${url}">Verify my email address</a></p>
    <p>This link expires in ${expiresInLabel}. If it expires you can request a new one from the login page.</p>
    <p>If you did not create this account you can ignore this email.</p>
  `,
});

/**
 * @returns {Promise<{ delivered: boolean, mode: "smtp"|"console"|"smtp-error" }>}
 */
const sendVerificationEmail = async ({ to, name, url, expiresInLabel }) => {
  if (isTestMode()) {
    // Test mode (verifyAuth.js): never send real mail to the fake .test
    // addresses; the script reads the raw link from the API response instead.
    console.log(`\n[auth][test] Verification link for ${to} (not emailed):\n  ${url}\n`);
    return { delivered: false, mode: "test" };
  }

  if (!isSmtpConfigured()) {
    // Dev mode: no mail provider configured, so surface the link in the console.
    console.log(`\n[auth][dev] Verification link for ${to}:\n  ${url}\n`);
    return { delivered: false, mode: "console" };
  }

  try {
    const mail = buildVerificationEmail({ name, url, expiresInLabel });

    await getTransport().sendMail({
      from: getMailFrom(),
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    return { delivered: true, mode: "smtp" };
  } catch (error) {
    // Mail problems must never break signup; the user can request a resend.
    console.error(`[auth] Failed to send verification email to ${to}:`, error.message);
    return { delivered: false, mode: "smtp-error" };
  }
};

/**
 * In development without SMTP the API also returns the link so the flow is
 * testable end-to-end. The link is also exposed in test mode (verifyAuth.js)
 * even when SMTP is configured, so the script works with or without a mail
 * provider. Real emails still go out in normal dev/production; the link is
 * never exposed in production.
 */
const canExposeDevLink = () =>
  isTestMode() ||
  (!isSmtpConfigured() &&
    String(process.env.NODE_ENV || "development").toLowerCase() !== "production");

module.exports = {
  isSmtpConfigured,
  canExposeDevLink,
  buildVerificationEmail,
  sendVerificationEmail,
};
