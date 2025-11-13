import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { queryClient } from './lib/query-client'
import { Layout } from './components/Layout'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'

// Pages
import { LandingPage } from './pages/Landing'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { DashboardPage } from './pages/Dashboard'
import { ScreenshotsPage } from './pages/Screenshots'
import { ApiKeysPage } from './pages/ApiKeys'
import { SubscriptionPage } from './pages/Subscription'
import { WebhooksPage } from './pages/Webhooks'
import { ScheduledPage } from './pages/Scheduled'
import { SettingsPage } from './pages/Settings'
import { AdminPage } from './pages/Admin'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/screenshots" element={<ScreenshotsPage />} />
              <Route path="/api-keys" element={<ApiKeysPage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
              <Route path="/scheduled" element={<ScheduledPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Admin routes */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch all - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App
