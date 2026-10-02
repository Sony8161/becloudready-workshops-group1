import { Navigate, Route, Routes } from 'react-router-dom'
import { homeFor, useAuth } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import DashboardPage from './pages/staff/DashboardPage'
import TraineesPage from './pages/staff/TraineesPage'
import TraineeDetailPage from './pages/staff/TraineeDetailPage'
import CohortsPage from './pages/staff/CohortsPage'
import CohortDetailPage from './pages/staff/CohortDetailPage'
import PlansPage from './pages/staff/PlansPage'
import PlanDetailPage from './pages/staff/PlanDetailPage'
import NoticesPage from './pages/staff/NoticesPage'
import ReportsPage from './pages/staff/ReportsPage'
import MyHomePage from './pages/trainee/MyHomePage'
import MyPlanPage from './pages/trainee/MyPlanPage'
import MyNoticesPage from './pages/trainee/MyNoticesPage'
import MyReportsPage from './pages/trainee/MyReportsPage'

const STAFF = ['HR', 'MANAGER']

function Home() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={homeFor(user)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route element={<RequireAuth roles={STAFF}><Layout /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/trainees" element={<TraineesPage />} />
        <Route path="/trainees/:id" element={<TraineeDetailPage />} />
        <Route path="/cohorts" element={<CohortsPage />} />
        <Route path="/cohorts/:id" element={<CohortDetailPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans/:id" element={<PlanDetailPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
      <Route element={<RequireAuth roles={['TRAINEE']}><Layout /></RequireAuth>}>
        <Route path="/me" element={<MyHomePage />} />
        <Route path="/me/plans/:id" element={<MyPlanPage />} />
        <Route path="/me/notices" element={<MyNoticesPage />} />
        <Route path="/me/notices/:id" element={<MyNoticesPage />} />
        <Route path="/me/reports" element={<MyReportsPage />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
