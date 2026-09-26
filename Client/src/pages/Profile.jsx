import NavBar from "../components/NavBar";
import { useAuth } from "../context/authContext";

const formatDate = (value) => {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
};

/** Basic profile page (Part 2). Read-only - no editing yet. */
function Profile() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your RicozSpend account details</p>

        <section className="card">
          <dl className="info-list">
            <div>
              <dt>Name</dt>
              <dd>{user?.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Email verified</dt>
              <dd>
                {user?.isEmailVerified
                  ? "Yes"
                  : "No - check your inbox or resend the link from the Login page"}
              </dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                <span className={`role-badge role-badge--${String(user?.role || "").toLowerCase()}`}>
                  {user?.role}
                </span>
              </dd>
            </div>
            <div>
              <dt>Account created</dt>
              <dd>{formatDate(user?.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(user?.updatedAt)}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>Stored as a bcrypt hash and never displayed</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}

export default Profile;
