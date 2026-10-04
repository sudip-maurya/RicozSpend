import React from "react";
import { Link, NavLink } from "react-router-dom";
import "../styles/logo.css";

/**
 * White dollar SVG icon inside red rounded square.
 * Matches the login page icon identically.
 */
export function LogoIcon({ size = 18, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

/**
 * Standardized RicozSpend Logo component.
 * Exact login page design: red rounded square with white $ icon + "RicozSpend" text.
 */
const Logo = ({
  to = "/",
  asNavLink = false,
  size = "md",
  pill = true,
  showText = true,
  className = "",
  iconClassName = "",
  textClassName = "",
  accentClassName = "ricoz-logo__text--accent",
  ariaLabel = "RicozSpend home",
  onClick,
}) => {
  const iconPixelSize =
    size === "lg" ? 18 : size === "nav" ? 15 : size === "sm" ? 13 : 17;

  const iconClasses = iconClassName
    ? iconClassName
    : "ricoz-logo__icon login-brand__icon";

  const textClasses = textClassName
    ? textClassName
    : "ricoz-logo__text login-brand__text";

  const content = (
    <>
      <span className={iconClasses} aria-hidden="true">
        <LogoIcon size={iconPixelSize} />
      </span>
      {showText && (
        <span className={textClasses}>
          Ricoz
          <span className={accentClassName || undefined}>Spend</span>
        </span>
      )}
    </>
  );

  const combinedClass = [
    "ricoz-logo",
    pill ? "ricoz-logo--pill" : "",
    size ? `ricoz-logo--${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (to) {
    if (asNavLink) {
      return (
        <NavLink
          to={to}
          className={combinedClass}
          aria-label={ariaLabel}
          onClick={onClick}
        >
          {content}
        </NavLink>
      );
    }
    return (
      <Link
        to={to}
        className={combinedClass}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={combinedClass} aria-label={ariaLabel} onClick={onClick}>
      {content}
    </div>
  );
};

export default Logo;
