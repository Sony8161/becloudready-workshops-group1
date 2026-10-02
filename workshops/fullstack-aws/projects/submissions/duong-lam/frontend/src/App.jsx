import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import PublicLayout from './layouts/PublicLayout.jsx'
import AppShell from './shell/AppShell.jsx'
import WelcomePage from './pages/WelcomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ForgotUsernamePage from './pages/ForgotUsernamePage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

// OPTIMIZED: lazy() = "download this page's code only when someone opens it".
// A customer never downloads the staff page, and the first page loads faster.
// While the code downloads, <Suspense> in AppShell shows a spinner.
const CustomerHome = lazy(() => import('./pages/customer/CustomerHome.jsx'))
const AdminHome = lazy(() => import('./pages/admin/AdminHome.jsx'))

// App is the top PARENT component. Three groups of pages:
//   public    /, /login, /register, /forgot-username, /forgot-password, /reset-password
//   customer  /app    ONE page with everything (must be signed in as CUSTOMER)
//   staff     /admin  ONE page with everything (must be signed in as ADMIN)
// Old links like /app/transfer or /admin/customers/3 land on the one page instead of a 404.
export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-username" element={<ForgotUsernamePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/app" element={<ProtectedRoute role="CUSTOMER"><AppShell /></ProtectedRoute>}>
        <Route index element={<CustomerHome />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AppShell /></ProtectedRoute>}>
        <Route index element={<AdminHome />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
