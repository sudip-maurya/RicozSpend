import NavBar from "../components/NavBar";
import SpendInsights from "../components/SpendInsights";
import "../styles/dashboard.css";

/** Insights page. */
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
