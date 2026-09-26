import NavBar from "../components/NavBar";
import SpendInsights from "../components/SpendInsights";
import "../styles/dashboard.css";

/**
 * Insights page (Part 8).
 *
 * The existing "/insights" nav entry (added back in Part 3 as a placeholder)
 * now renders the Automatic Spend Insights feature instead of "Coming soon".
 *
 * It reuses the exact same reusable section as the Dashboard -
 * <SpendInsights /> - so there is no duplicate component, no duplicate API and
 * no second filtering system. Without a date filter prop it reports on all of
 * the user's transactions; the Dashboard version follows the dashboard's own
 * date filter.
 */
function Insights() {
  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="dashboard-head">
          <div>
            <h1 className="page-title">Insights</h1>
            <p className="page-subtitle">
              Automatic, rule-based insights calculated from your transactions.
            </p>
          </div>
        </div>

        <SpendInsights />
      </main>
    </div>
  );
}

export default Insights;
