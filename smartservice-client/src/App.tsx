
import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import EmployeesPage from './pages/EmployeesPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import CustomerDashboard from './pages/CustomerDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import ManagerAnalytics from './pages/ManagerAnalytics'
import NewRequestPage from './pages/NewRequestPage'
import TicketDetailsPage from './pages/TicketDetailsPage'
import EmployeeDashboard from './pages/EmployeeDashboard'
import EmployeeProfile from './pages/EmployeeProfile'
import AccountProfile from './pages/AccountProfile'
import AdminDashboard from './pages/AdminDashboard'

import './App.css'

type UserRole =
  | 'CUSTOMER'
  | 'MANAGER'
  | 'EMPLOYEE'
  | 'ADMIN'

type StoredUser = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
}

function getStoredUser(): StoredUser | null {
  try {
    const storedUser = localStorage.getItem('user')

    if (!storedUser) {
      return null
    }

    const user: unknown = JSON.parse(storedUser)

    if (!user || typeof user !== 'object') {
      return null
    }

    return user as StoredUser
  } catch {
    return null
  }
}

function getUserRole(): UserRole | null {
  const user = getStoredUser()

  if (!user || typeof user.role !== 'string') {
    return null
  }

  const role = user.role.trim().toUpperCase()

  if (
    role === 'CUSTOMER' ||
    role === 'MANAGER' ||
    role === 'EMPLOYEE' ||
    role === 'ADMIN'
  ) {
    return role
  }

  return null
}

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'CUSTOMER':
      return '/dashboard'

    case 'MANAGER':
      return '/manager/dashboard'

    case 'EMPLOYEE':
      return '/employee/dashboard'

    case 'ADMIN':
      return '/admin/dashboard'
  }
}

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[]
  children: React.ReactNode
}) {
  const token = localStorage.getItem('token')
  const role = getUserRole()

  if (!token || !role) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(role)) {
    return (
      <Navigate
        to={getDashboardPath(role)}
        replace
      />
    )
  }

  return <>{children}</>
}

function HomeRedirect() {
  const token = localStorage.getItem('token')
  const role = getUserRole()

  if (!token || !role) {
    return <Navigate to="/login" replace />
  }

  return (
    <Navigate
      to={getDashboardPath(role)}
      replace
    />
  )
}

function App() {
  return (
    <Routes>
      {/* HOME */}

      <Route
        path="/"
        element={<HomeRedirect />}
      />

      {/* AUTHENTICATION */}

      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/register"
        element={<RegisterPage />}
      />

      {/* CUSTOMER ROUTES */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customer/profile"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <AccountProfile role="CUSTOMER" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets/new"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <NewRequestPage />
          </ProtectedRoute>
        }
      />

      {/* SHARED TICKET DETAILS */}

      <Route
        path="/tickets/:id"
        element={
          <ProtectedRoute
            allowedRoles={[
              'CUSTOMER',
              'MANAGER',
              'EMPLOYEE',
            ]}
          >
            <TicketDetailsPage />
          </ProtectedRoute>
        }
      />

      {/* MANAGER ROUTES */}

      <Route
        path="/manager/dashboard"
        element={
          <ProtectedRoute allowedRoles={['MANAGER']}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager/analytics"
        element={
          <ProtectedRoute allowedRoles={['MANAGER']}>
            <ManagerAnalytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager/employees"
        element={
          <ProtectedRoute allowedRoles={['MANAGER']}>
            <EmployeesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager/profile"
        element={
          <ProtectedRoute allowedRoles={['MANAGER']}>
            <AccountProfile role="MANAGER" />
          </ProtectedRoute>
        }
      />

      {/* EMPLOYEE ROUTES */}

      <Route
        path="/employee/dashboard"
        element={
          <ProtectedRoute allowedRoles={['EMPLOYEE']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/employee/profile"
        element={
          <ProtectedRoute allowedRoles={['EMPLOYEE']}>
            <EmployeeProfile />
          </ProtectedRoute>
        }
      />

      {/* ADMIN ROUTES */}

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/employees"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <EmployeesPage />
          </ProtectedRoute>
        }
      />

      {/* UNKNOWN ROUTES */}

      <Route
        path="*"
        element={<HomeRedirect />}
      />
    </Routes>
  )
}

export default App
