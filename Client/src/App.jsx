import { BrowserRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthProvider";
import { ThemeProvider } from "./context/themeContext";
import { ROLES } from "./constants/roles";
import AdminOverview from "./pages/AdminOverview";
import AlertsInsightsCenter from "./pages/AlertsInsightsCenter";
import Budget from "./pages/Budget";
import Dashboard from "./pages/Dashboard";
import DepartmentSpendingPatterns from "./pages/DepartmentSpendingPatterns";
import ImportTransactions from "./pages/ImportTransactions";
import Insights from "./pages/Insights";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Signup from "./pages/Signup";
import Transactions from "./pages/Transactions";
import SpendAnalysis from "./pages/SpendAnalysis";
import VerifyEmail from "./pages/VerifyEmail";
import "./styles/auth.css";
import "./styles/landing.css";

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public informational landing page */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* Part 2: public page that consumes the emailed verification token */}
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Part 2: pages below require a valid session */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            {/* Part 2: Admin-only page (Viewers are redirected to the Dashboard) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminOverview />
                </ProtectedRoute>
              }
            />

            {/* Part 4: Spend / Transaction management */}
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <ImportTransactions />
                </ProtectedRoute>
              }
            />
            {/* Part 6: Spend analysis & charts */}
            <Route
              path="/analysis"
              element={
                <ProtectedRoute>
                  <SpendAnalysis />
                </ProtectedRoute>
              }
            />
            {/* Part 13: department spending patterns (shared, read-only analytics) */}
            <Route
              path="/departments"
              element={
                <ProtectedRoute>
                  <DepartmentSpendingPatterns />
                </ProtectedRoute>
              }
            />
            {/* Part 8: automatic spend insights (reuses the Part 3 nav entry) */}
            <Route
              path="/insights"
              element={
                <ProtectedRoute>
                  <Insights />
                </ProtectedRoute>
              }
            />
            {/* Part 14: alerts & insights center (rule-based, read-only, all roles) */}
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <AlertsInsightsCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/budget"
              element={
                <ProtectedRoute>
                  <Budget />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
