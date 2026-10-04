import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../context/authContext";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const navLinkClass = ({ isActive }) =>
  isActive ? "app-nav__link app-nav__link--active" : "app-nav__link";

/** Main navigation - ONE shared list for every authenticated page and role. */
const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/import", label: "Import" },
  { to: "/analysis", label: "Analysis" },
  // Part 13: department spending patterns - same shared entry for every role.
  { to: "/departments", label: "Departments" },
  { to: "/insights", label: "Insights" },
  // Part 14: alerts & insights center - read-only hub for every role.
  { to: "/alerts", label: "Alerts" },
  { to: "/budget", label: "Budget" },
  { to: "/profile", label: "Profile" },
];

/** Admin-only modules (/admin = user overview). */
const ADMIN_LINKS = [{ to: "/admin", label: "Admin" }];

/** Small shared header for the authenticated pages (Part 2). */
const NavBar = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navLinksRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  // The role badge always shows "Admin"/"Viewer".
  const showName =
    Boolean(user?.name) &&
    user.name.trim().toLowerCase() !== String(user?.role || "").trim().toLowerCase();

  // Same shared items for every role; Admins get the Admin-only entries appended.
  const links = isAdmin ? [...NAV_LINKS, ...ADMIN_LINKS] : NAV_LINKS;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true, state: { message: "You have been logged out." } });
  };

  // Position the sliding active indicator over the active link after layout (GarageCare anti-jump)
  useIsomorphicLayoutEffect(() => {
    if (!navLinksRef.current) return;
    const activeEl = navLinksRef.current.querySelector(".app-nav__link--active");
    if (activeEl) {
      const containerRect = navLinksRef.current.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        left: activeRect.left - containerRect.left + navLinksRef.current.scrollLeft,
        top: activeRect.top - containerRect.top,
        width: activeRect.width,
        height: activeRect.height,
        opacity: 1,
      });
      // Enable sliding transitions after the initial render so there is no jump on first paint
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, 40);
      return () => clearTimeout(timer);
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [location.pathname, isAdmin]);

  // Keep indicator aligned on window resize, font loading, or container scroll
  useEffect(() => {
    const updatePosition = () => {
      if (!navLinksRef.current) return;
      const activeEl = navLinksRef.current.querySelector(".app-nav__link--active");
      if (activeEl) {
        const containerRect = navLinksRef.current.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        setIndicatorStyle((prev) => ({
          ...prev,
          left: activeRect.left - containerRect.left + navLinksRef.current.scrollLeft,
          top: activeRect.top - containerRect.top,
          width: activeRect.width,
          height: activeRect.height,
          opacity: 1,
        }));
      }
    };

    window.addEventListener("resize", updatePosition);
    const container = navLinksRef.current;
    if (container) {
      container.addEventListener("scroll", updatePosition, { passive: true });
    }

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(updatePosition);
    }

    let ro;
    if (typeof ResizeObserver !== "undefined" && container) {
      ro = new ResizeObserver(updatePosition);
      ro.observe(container);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      if (container) {
        container.removeEventListener("scroll", updatePosition);
      }
      if (ro) ro.disconnect();
    };
  }, [isAdmin]);

  return (
    <header className="app-nav">
      <Logo
        to="/dashboard"
        asNavLink
        size="nav"
        className="app-nav__brand-pill"
        iconClassName="app-nav__brand-icon"
        textClassName="app-nav__brand-text"
        accentClassName="app-nav__brand-text--accent"
      />

      <nav className="app-nav__links" ref={navLinksRef}>
        {indicatorStyle.opacity > 0 && (
          <span
            className={`app-nav__indicator ${hasAnimated ? "is-animating" : ""}`}
            style={{
              transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
            }}
            aria-hidden="true"
          />
        )}
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={navLinkClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="app-nav__user">
        <ThemeToggle />
        {user && (
          <div className="app-nav__profile-group">
            {showName && <span className="app-nav__name">{user.name}</span>}
            <span className={`role-badge role-badge--${String(user.role || "").toLowerCase()}`}>
              {user.role}
            </span>
          </div>
        )}
        <button type="button" className="app-nav__logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default NavBar;
