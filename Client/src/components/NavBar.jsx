import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/authContext";

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

  return (
    <header className="app-nav">
      <span className="app-nav__brand">RicozSpend</span>

      <nav className="app-nav__links">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={navLinkClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="app-nav__user">
        {user && (
          <span className="app-nav__identity">
            {showName && <span className="app-nav__name">{user.name}</span>}
            <span className={`role-badge role-badge--${String(user.role || "").toLowerCase()}`}>
              {user.role}
            </span>
          </span>
        )}
        <button type="button" className="btn btn--ghost" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default NavBar;
