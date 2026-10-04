import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { fetchDepartmentSpending } from "../services/analyticsService";
import { formatMoney, formatShortMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/departments.css";

const EMPTY_FILTERS = {};

/** 72.46 / 0 -> "72.46%" */
const formatShare = (value) => {
  const share = Number(value);
  return Number.isFinite(share) ? `${share.toFixed(1)}%` : "—";
};

/** Donut palette: Top 3 red shades, remaining clean slate/gray shades */
const DONUT_COLORS = [
  "#dc2626", // 1st - Solid RicozSpend red
  "#ef4444", // 2nd - Coral red
  "#f87171", // 3rd - Pastel red
  "#94a3b8", // 4th - Slate 400
  "#cbd5e1", // 5th - Slate 300
  "#64748b", // 6th - Slate 500
  "#e2e8f0", // 7th - Slate 200
  "#475569", // 8th - Slate 600
];

const getSliceColor = (index) => DONUT_COLORS[index % DONUT_COLORS.length];

/** Contextual Department Icon Helper */
function DepartmentIcon({ name, isTop }) {
  const norm = String(name || "").toLowerCase();

  if (norm.includes("it") || norm.includes("tech")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }
  if (norm.includes("op")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  if (norm.includes("market")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    );
  }
  if (norm.includes("hr")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (norm.includes("sales")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }
  if (norm.includes("fin")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (norm.includes("des")) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    );
  }

  // Default building
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="9" y1="6" x2="9.01" y2="6" />
      <line x1="15" y1="6" x2="15.01" y2="6" />
      <line x1="9" y1="10" x2="9.01" y2="10" />
      <line x1="15" y1="10" x2="15.01" y2="10" />
      <line x1="9" y1="14" x2="9.01" y2="14" />
      <line x1="15" y1="14" x2="15.01" y2="14" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}

function DepartmentSpending({ filters = EMPTY_FILTERS, showChart = false }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [hoveredDept, setHoveredDept] = useState(null);

  const { range = "", from = "", to = "", category = "", department = "", vendor = "" } = filters || {};

  useEffect(() => {
    let isActive = true;

    const loadDepartments = async () => {
      setIsLoading(true);
      setError("");

      const result = await fetchDepartmentSpending({ range, from, to, category, department, vendor });

      if (!isActive) return;

      if (result.error) {
        setData(null);
        setError(result.error);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    loadDepartments();

    return () => {
      isActive = false;
    };
  }, [range, from, to, category, department, vendor, reloadKey]);

  const retry = () => setReloadKey((key) => key + 1);

  const rawDepartments = data?.departments || [];
  // Strictly enforce highest to lowest ranking
  const departments = [...rawDepartments].sort((a, b) => b.totalSpend - a.totalSpend);
  const noData = Boolean(data && departments.length === 0);

  const highestDepartment = departments[0] || null;
  const averagePerDepartment =
    typeof data?.averageSpendPerDepartment === "number"
      ? data.averageSpendPerDepartment
      : data && data.departmentCount > 0
        ? Number((data.totalSpend / data.departmentCount).toFixed(2))
        : 0;

  const maxSpend = departments[0]?.totalSpend || 1;

  if (isLoading) {
    return <p className="dashboard-loading">Loading department spending&hellip;</p>;
  }

  if (error) {
    return (
      <div className="dashboard-alert alerts-error" role="alert">
        <span>{error}</span>
        <button type="button" className="btn btn--ghost" onClick={retry}>
          Retry
        </button>
      </div>
    );
  }

  if (noData) {
    return (
      <section className="card vendor-compare-card">
        <p className="card__text">No department spending data available for the selected filters.</p>
      </section>
    );
  }

  if (!data) return null;

  return (
    <div className="dept-view-container">
      {/* 2. KPI Cards (4, in one row) with left red-tint icons */}
      <div className="dept-kpi-grid">
        {/* TOTAL DEPARTMENT SPEND */}
        <div className="dept-kpi-card">
          <div className="dept-kpi-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div className="dept-kpi-content">
            <span className="dept-kpi-label">TOTAL DEPARTMENT SPEND</span>
            <span className="dept-kpi-value">{formatMoney(data.totalSpend)}</span>
            <span className="dept-kpi-trend dept-kpi-trend--up">
              <span className="dept-kpi-trend-arrow">↑</span> 12% vs. previous period
            </span>
          </div>
        </div>

        {/* TRANSACTIONS */}
        <div className="dept-kpi-card">
          <div className="dept-kpi-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="dept-kpi-content">
            <span className="dept-kpi-label">TRANSACTIONS</span>
            <span className="dept-kpi-value">{data.totalTransactions}</span>
            <span className="dept-kpi-trend dept-kpi-trend--up">
              <span className="dept-kpi-trend-arrow">↑</span> 8% vs. previous period
            </span>
          </div>
        </div>

        {/* HIGHEST-SPENDING DEPARTMENT */}
        <div className="dept-kpi-card">
          <div className="dept-kpi-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
              <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
            </svg>
          </div>
          <div className="dept-kpi-content">
            <span className="dept-kpi-label">HIGHEST-SPENDING DEPARTMENT</span>
            <span className="dept-kpi-value">{highestDepartment ? highestDepartment.name : "—"}</span>
            <div className="dept-kpi-subtext">
              <span className="dept-kpi-amount">{highestDepartment ? formatMoney(highestDepartment.totalSpend) : "—"}</span>
              <span className="dept-kpi-share">{highestDepartment ? ` · ${formatShare(highestDepartment.percentage)} of total` : ""}</span>
            </div>
          </div>
        </div>

        {/* AVERAGE SPEND PER DEPARTMENT */}
        <div className="dept-kpi-card">
          <div className="dept-kpi-icon-wrap" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="dept-kpi-content">
            <span className="dept-kpi-label">AVERAGE SPEND PER DEPARTMENT</span>
            <span className="dept-kpi-value">{formatMoney(averagePerDepartment)}</span>
            <span className="dept-kpi-trend dept-kpi-trend--up">
              <span className="dept-kpi-trend-arrow">↑</span> 11% vs. previous period
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="dept-analytics-grid">
        {/* 3. TOTAL SPEND BY DEPARTMENT (left big card) */}
        <div className="dept-card dept-bars-card">
          <div className="dept-card-head">
            <div>
              <h2 className="dept-card-title">Total Spend by Department</h2>
              <p className="dept-card-subtitle">
                Departments ranked by total spending (highest to lowest).
              </p>
            </div>
            <span className="dept-badge">
              {departments.length} {departments.length === 1 ? "Department" : "Departments"}
            </span>
          </div>

          <div className="dept-bars-list">
            {departments.map((dept, index) => {
              const isTop = index === 0;
              const fillPct = maxSpend > 0 ? (dept.totalSpend / maxSpend) * 100 : 0;
              const isHovered = hoveredDept === dept.name;

              return (
                <div
                  key={dept.name}
                  className="dept-bar-row"
                  onMouseEnter={() => setHoveredDept(dept.name)}
                  onMouseLeave={() => setHoveredDept(null)}
                  title={`${dept.name}: ${formatMoney(dept.totalSpend)} (${formatShare(dept.percentage)}) • ${dept.transactionCount} transactions`}
                >
                  {isHovered && (
                    <div className="dept-bar-tooltip" role="tooltip">
                      <span><strong>{dept.name}</strong></span>
                      <span>•</span>
                      <span>{formatMoney(dept.totalSpend)}</span>
                      <span>({formatShare(dept.percentage)})</span>
                      <span>•</span>
                      <span>{dept.transactionCount} {dept.transactionCount === 1 ? "txn" : "txns"}</span>
                    </div>
                  )}

                  <div className="dept-bar-left">
                    <span className={`dept-bar-icon ${isTop ? "dept-bar-icon--top" : ""}`}>
                      <DepartmentIcon name={dept.name} isTop={isTop} />
                    </span>
                    <span className="dept-bar-name" title={dept.name}>
                      {dept.name}
                    </span>
                  </div>

                  <div className="dept-bar-track" aria-hidden="true">
                    <div
                      className={`dept-bar-fill ${isTop ? "dept-bar-fill--top" : ""}`}
                      style={{ width: `${Math.max(fillPct, 2)}%` }}
                    />
                  </div>

                  <div className="dept-bar-right">
                    <span className="dept-bar-amount">{formatMoney(dept.totalSpend)}</span>
                    <span className="dept-bar-pct">{formatShare(dept.percentage)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 & 5. Right Column: DEPARTMENT SHARE + KEY INSIGHT BOX */}
        <div className="dept-right-stack">
          {/* 4. DEPARTMENT SHARE (Donut) */}
          <div className="dept-donut-card">
            <div className="dept-card-head">
              <div>
                <h2 className="dept-card-title">Department Share</h2>
                <p className="dept-card-subtitle">Spending distribution across departments</p>
              </div>
            </div>

            <div className="dept-donut-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={departments}
                    dataKey="totalSpend"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="var(--card, #ffffff)"
                    strokeWidth={2}
                  >
                    {departments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getSliceColor(index)} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatMoney(value), "Total Spend"]}
                    labelFormatter={(label) => `Department: ${label}`}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="dept-donut-center" aria-hidden="true">
                <span className="dept-donut-center__amount">{formatShortMoney(data.totalSpend)}</span>
                <span className="dept-donut-center__label">Total Spend</span>
              </div>
            </div>

            {/* Legend: colored dot + name + % (top 3 red shades, baaki gray shades) */}
            <div className="dept-donut-legend">
              {departments.map((dept, index) => (
                <div key={dept.name} className="dept-legend-row">
                  <div className="dept-legend-left">
                    <span
                      className="dept-legend-dot"
                      style={{ backgroundColor: getSliceColor(index) }}
                      aria-hidden="true"
                    />
                    <span className="dept-legend-name">{dept.name}</span>
                  </div>
                  <span className="dept-legend-pct">{formatShare(dept.percentage)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. KEY INSIGHT BOX (donut ke neeche, light red bg) */}
          <div className="dept-insight-box">
            <div className="dept-insight-header">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="dept-insight-title">Key Insight</span>
            </div>
            <p className="dept-insight-text">
              {highestDepartment ? (
                <>
                  <strong>{highestDepartment.name}</strong> department has the highest spending at{" "}
                  <strong>{formatMoney(highestDepartment.totalSpend)}</strong> which is{" "}
                  <strong>{formatShare(highestDepartment.percentage)}</strong> of the total department spend.
                </>
              ) : (
                "No department spending recorded for this selection."
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed breakdown table */}
      <section className="card dept-table-card">
        <div className="dept-table-head">
          <h2 className="dept-card-title">Department Spending Breakdown</h2>
          <span className="dept-badge">{departments.length} Records</span>
        </div>
        <div className="recent-table-wrap">
          <table className="recent-table">
            <thead>
              <tr>
                <th>Department</th>
                <th className="recent-table__amount">Total Spend</th>
                <th>Transaction Count</th>
                <th>% of Total Spend</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="recent-table__amount">{formatMoney(row.totalSpend)}</td>
                  <td>{row.transactionCount}</td>
                  <td>
                    <div className="vendor-compare__share">
                      <span className="vendor-compare__share-value">
                        {formatShare(row.percentage)}
                      </span>
                      <span className="vendor-compare__share-bar" aria-hidden="true">
                        <span
                          className="vendor-compare__share-fill"
                          style={{ width: `${Math.min(Math.max(Number(row.percentage) || 0, 0), 100)}%` }}
                        />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default DepartmentSpending;
