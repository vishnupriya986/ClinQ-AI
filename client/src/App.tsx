import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import NewPredictionPage from './pages/NewPredictionPage'
import PredictionFormPage from './pages/PredictionFormPage'
import HistoryPage from './pages/HistoryPage'
import PredictionDetailsPage from './pages/PredictionDetailsPage'
import ChatPage from './pages/ChatPage'
import IntakeDetailsPage from './pages/IntakeDetailsPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/new-prediction" element={<NewPredictionPage />} />
          <Route path="/prediction/:disease" element={<PredictionFormPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/intake/:id" element={<IntakeDetailsPage />} />
          <Route path="/history/:id" element={<PredictionDetailsPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
