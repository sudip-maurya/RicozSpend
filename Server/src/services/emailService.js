/** Email delivery service for verification links. */

const dns = require("node:dns");
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

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
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
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

/** Send verification email or log link in non-SMTP environments. */
const sendVerificationEmail = async ({ to, name, url, expiresInLabel }) => {
  if (isTestMode()) {
    // Test mode: log link instead of sending
    console.log(`\n[auth][test] Verification link for ${to} (not emailed):\n  ${url}\n`);
    return { delivered: false, mode: "test" };
  }

  if (!isSmtpConfigured()) {
    // Development fallback: log link to console
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
    console.error(`[auth] Failed to send verification email to ${to}:`, error.message);
    return { delivered: false, mode: "smtp-error" };
  }
};

/** Check if dev verification link can be exposed. */
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
