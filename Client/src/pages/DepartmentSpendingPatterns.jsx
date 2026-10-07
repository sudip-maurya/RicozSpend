import { useEffect, useState } from "react";

import NavBar from "../components/NavBar";
import Dropdown from "../components/Dropdown";
import DepartmentSpending from "../components/DepartmentSpending";
import { fetchAnalyticsSummary } from "../services/analyticsService";
import "../styles/dashboard.css";
import "../styles/transactions.css";
import "../styles/departments.css";

const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "lastmonth", label: "Last Month" },
  { value: "last3months", label: "Last 3 Months" },
  { value: "last6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

/** Department Spending Patterns page. */
function DepartmentSpendingPatterns() {
  const [range, setRange] = useState("last3months");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");

  // Facet options for Category and Department dropdowns
  const [facets, setFacets] = useState({ categories: [], departments: [] });

  useEffect(() => {
    let isActive = true;

    const loadFacets = async () => {
      const result = await fetchAnalyticsSummary();

      if (!isActive || result.error || !result.data?.facets) return;

      setFacets({
        categories: result.data.facets.categories || [],
        departments: result.data.facets.departments || [],
      });
    };

    loadFacets();

    return () => {
      isActive = false;
    };
  }, []);

  const handleRangeChange = (newRange) => {
    setRange(newRange);
    if (newRange !== "custom") {
      setFrom("");
      setTo("");
    }
  };

  const resetFilters = () => {
    setRange("last3months");
    setFrom("");
    setTo("");
    setCategory("");
    setDepartment("");
  };

  const hasActiveFilters =
    range !== "last3months" || Boolean(from) || Boolean(to) || Boolean(category) || Boolean(department);

  const filters = {
    range,
    from: range === "custom" ? from : "",
    to: range === "custom" ? to : "",
    category,
    department,
  };

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        {/* 1. HEADER: Title + Subtitle on left, Filters on right */}
        <div className="dept-header-wrap">
          <div className="dept-header-left">
            <h1 className="page-title">Department Spending Patterns</h1>
            <p className="page-subtitle">
              Total spend, share and averages for every department – calculated from your transactions.
            </p>
          </div>

          <div className="dept-header-filters">
            <div className="dept-filter-item">
              <Dropdown
                id="dept-range"
                label="Date Range"
                value={range}
                onChange={(e) => handleRangeChange(e.target.value)}
                options={DATE_RANGES}
              />
            </div>

            <div className="dept-filter-item">
              <Dropdown
                id="dept-category"
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: "", label: "All Categories" },
                  ...facets.categories.map((c) => ({ value: c, label: c })),
                ]}
              />
            </div>

            <div className="dept-filter-item">
              <Dropdown
                id="dept-department"
                label="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                options={[
                  { value: "", label: "All Departments" },
                  ...facets.departments.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>

            {/* From Date / To Date inputs for custom date selection & test suites */}
            <div
              className="dept-filter-dates"
              style={{ display: range === "custom" ? "flex" : "none" }}
            >
              <input
                id="dept-from"
                className="dept-date-input"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From Date"
              />
              <input
                id="dept-to"
                className="dept-date-input"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To Date"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="dept-reset-btn"
                onClick={resetFilters}
                title="Reset all filters"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* 2 to 5. Modern Department Spending Visualizations */}
        <DepartmentSpending filters={filters} showChart />
      </main>
    </div>
  );
}

export default DepartmentSpendingPatterns;