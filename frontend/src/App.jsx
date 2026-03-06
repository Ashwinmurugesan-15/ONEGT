import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CapabilityProvider } from './contexts/CapabilityContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Loading from './components/common/Loading';

// HRMS Pages
import {
  Dashboard,
  Associates,
  Projects,
  Allocations,
  Payroll,
  Expenses,
  CurrencyRates,
  Customers,
  Timesheets,
  Assets,
  Settings,
  Profile,
  SalaryStructure,
  OrganizationChart,
  Leaves
} from './pages/hrms';
import {
  PerformanceDashboard,
  GoalTemplates,
  AppraisalCycles,
  AppraisalList,
  AppraisalDocument
} from './pages/performance';
import {
  SettingsLayout,
  CompanySettings,
  IAMSettings,
  LeaveSetup
} from './pages/settings';

// CRMS Pages
import {
  CRMSDashboard,
  Leads,
  Opportunities,
  CRMSCustomers,
  Contacts,
  Deals,
  CRMSTasks,
  Calls,
  CRMSInvoices,
  TemplateDesigner,
  FinanceView
} from './pages/crms';

// Talent Management Pages
import {
  TalentDashboard,
  DemandsPage,
  CandidatesPage,
  InterviewsPage
} from './pages/talent';
import TalentModuleWrapper from './modules/talent/TalentModuleWrapper';

// Assessment Portal Pages
import AssessmentModuleWrapper from './modules/assessment/AssessmentModuleWrapper';
import AssessmentDashboardSwitcher from './modules/assessment/AssessmentDashboardSwitcher';
import CreateAssessment from './modules/assessment/components/CreateAssessment';
import ExaminerDashboard from './modules/assessment/pages/ExaminerDashboard';
import CandidateDashboard from './modules/assessment/pages/CandidateDashboard';
import AssessmentDetail from './modules/assessment/pages/AssessmentDetail';
import TakeAssessment from './modules/assessment/pages/TakeAssessment';
import AssessmentResult from './modules/assessment/pages/AssessmentResult';
import LearningResources from './modules/assessment/pages/LearningResources';
import UserManagement from './modules/assessment/pages/UserManagement';
import CandidateResultDetail from './modules/assessment/pages/CandidateResultDetail';
import AdminDashboard from './modules/assessment/pages/AdminDashboard';

// Protected route wrapper that checks authentication
function ProtectedRoute({ children, requiredRoles = [] }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access if required
  if (requiredRoles.length > 0 && !requiredRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Route that redirects authenticated users away from login
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Root Redirect */}
      <Route path="/" element={<Navigate to="/hrms" replace />} />

      {/* HRMS Module */}
      <Route
        path="/hrms"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="associates" element={<Associates />} />
        <Route path="projects" element={<Projects />} />
        <Route path="allocations" element={<Allocations />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="currency" element={<CurrencyRates />} />
        <Route path="customers" element={<Customers />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="assets" element={<Assets />} />
        <Route path="settings" element={<Settings />}>
          <Route path="company" element={<CompanySettings />} />
          <Route path="iam" element={<IAMSettings />} />
          <Route path="leave" element={<LeaveSetup />} />
        </Route>
        <Route path="profile" element={<Profile />} />
        <Route path="org-chart" element={<OrganizationChart />} />
        <Route path="paystructure" element={<SalaryStructure />} />
      </Route>

      {/* Performance Management Module */}
      <Route
        path="/performance"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PerformanceDashboard />} />
        <Route path="templates" element={<GoalTemplates />} />
        <Route path="cycles" element={<AppraisalCycles />} />
        <Route path="appraisals" element={<AppraisalList />} />
        <Route path="appraisals/:appraisalId" element={<AppraisalDocument />} />
      </Route>

      {/* CRMS Module */}
      <Route
        path="/crms"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CRMSDashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="customers" element={<CRMSCustomers />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="deals" element={<Deals />} />
        <Route path="tasks" element={<CRMSTasks />} />
        <Route path="calls" element={<Calls />} />
        <Route path="invoices" element={<CRMSInvoices />} />
        <Route path="invoice-templates" element={<TemplateDesigner />} />
        <Route path="finance" element={<ProtectedRoute requiredRoles={['Admin']}><FinanceView /></ProtectedRoute>} />
      </Route>

      {/* Talent Management Placeholders */}
      <Route
        path="/talent"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route element={<TalentModuleWrapper />}>
          <Route index element={<TalentDashboard />} />
          <Route path="demands" element={<DemandsPage />} />
          <Route path="candidates" element={<CandidatesPage />} />
          <Route path="interviews" element={<InterviewsPage />} />
          <Route path="*" element={<TalentDashboard />} />
        </Route>
      </Route>

      {/* Assessment Portal Placeholders */}
      <Route
        path="/assessment"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route element={<AssessmentModuleWrapper />}>
          <Route index element={<AssessmentDashboardSwitcher />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/users" element={<UserManagement />} />
          <Route path="examiner" element={<ExaminerDashboard />} />
          <Route path="examiner/result/:assessmentId/:userId" element={<CandidateResultDetail />} />
          <Route path="candidate" element={<CandidateDashboard />} />
          <Route path="create" element={<CreateAssessment />} />
          <Route path="manage/:id" element={<AssessmentDetail />} />
          <Route path="test/:id" element={<TakeAssessment />} />
          <Route path="test/:id/result" element={<AssessmentResult />} />
          <Route path="learning" element={<LearningResources />} />
          <Route path="*" element={<AssessmentDashboardSwitcher />} />
        </Route>
      </Route>

    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CapabilityProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </CapabilityProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
