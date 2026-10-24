
import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { NavLink, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

import './ManagerDashboard.css'
import './AdminDashboard.css'

const API_URL = 'http://localhost:5255/api'

type StaffMember = {
  id: number
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  role: string
  jobTitle: string | null
  isActive: boolean
}

type StoredUser = {
  firstName: string
  lastName: string
  email: string
  role: string
}

function getStoredUser(): StoredUser | null {
  try {
    const value = localStorage.getItem('user')

    if (!value) return null

    const user: unknown = JSON.parse(value)

    if (!user || typeof user !== 'object') {
      return null
    }

    return user as StoredUser
  } catch {
    return null
  }
}

function AdminDashboard() {
  const navigate = useNavigate()
  const user = getStoredUser()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setError('')

    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const response = await axios.get<StaffMember[]>(
        `${API_URL}/Users/employees`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setStaff(response.data)
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return
      }

      if (
        axios.isAxiosError(err) &&
        err.response?.status === 403
      ) {
        setError('You do not have permission to view staff records.')
      } else {
        setError('Unable to load staff statistics.')
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStaff()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadStaff])

  const statistics = useMemo(() => {
    const employees = staff.filter(
      member => member.role?.toUpperCase() === 'EMPLOYEE'
    )

    const managers = staff.filter(
      member => member.role?.toUpperCase() === 'MANAGER'
    )

    return {
      totalStaff: staff.length,
      totalEmployees: employees.length,
      totalManagers: managers.length,
      activeStaff: staff.filter(member => member.isActive).length,
      inactiveStaff: staff.filter(member => !member.isActive).length,
    }
  }, [staff])

  const recentStaff = useMemo(() => {
    return [...staff]
      .sort((a, b) => b.id - a.id)
      .slice(0, 5)
  }, [staff])

  const fullName = [
    user?.firstName,
    user?.lastName,
  ]
    .filter(Boolean)
    .join(' ')

  const initials = [
    user?.firstName?.charAt(0),
    user?.lastName?.charAt(0),
  ]
    .filter(Boolean)
    .join('')
    .toUpperCase() || 'A'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  const openStaffManagement = () => {
    navigate('/admin/employees')
  }

  const openCreateStaff = () => {
    navigate('/admin/employees#create-staff')
  }

  return (
    <div className="manager-dashboard admin-dashboard">
      {/* SIDEBAR */}
      <aside className="manager-sidebar">
        <div>
          <div className="manager-brand">
            <div className="manager-logo">S</div>

            <div>
              <h2>SmartService</h2>
              <p>Admin Portal</p>
            </div>
          </div>

          <nav
            className="manager-nav"
            aria-label="Admin navigation"
          >
            <NavLink
              to="/admin/dashboard"
              end
              className={({ isActive }) =>
                `manager-nav-item ${
                  isActive ? 'active' : ''
                }`
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/admin/employees"
              className={({ isActive }) =>
                `manager-nav-item ${
                  isActive ? 'active' : ''
                }`
              }
            >
              Staff Management
            </NavLink>
          </nav>
        </div>

        <div className="manager-sidebar-bottom">
          <ThemeToggle />

          <button
            type="button"
            className="manager-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="manager-main">
        <header className="manager-header">
          <div>
            <p className="manager-page-label">
              SYSTEM ADMINISTRATION
            </p>

            <h1>Admin Dashboard</h1>

            <p>
              Welcome back, {user?.firstName || 'Administrator'}.
              Manage your SmartService staff and accounts.
            </p>
          </div>

          <div className="manager-profile">
            <div className="manager-avatar">
              {initials}
            </div>

            <div>
              <strong>{fullName || 'Administrator'}</strong>
              <span>System Administrator</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="manager-error" role="alert">
            {error}

            <button
              type="button"
              className="admin-retry-button"
              onClick={() => void loadStaff()}
            >
              Try Again
            </button>
          </div>
        )}

        {/* STATISTICS */}
        <section
          className="manager-stats"
          aria-label="Staff statistics"
        >
          <article className="manager-stat-card">
            <span>Total Staff</span>
            <strong>
              {loading ? '...' : statistics.totalStaff}
            </strong>
            <p>Employees and managers</p>
          </article>

          <article className="manager-stat-card">
            <span>Employees</span>
            <strong>
              {loading ? '...' : statistics.totalEmployees}
            </strong>
            <p>Registered employee accounts</p>
          </article>

          <article className="manager-stat-card">
            <span>Managers</span>
            <strong>
              {loading ? '...' : statistics.totalManagers}
            </strong>
            <p>Registered manager accounts</p>
          </article>

          <article className="manager-stat-card">
            <span>Active Staff</span>
            <strong>
              {loading ? '...' : statistics.activeStaff}
            </strong>
            <p>
              {loading
                ? 'Loading account status...'
                : `${statistics.inactiveStaff} inactive accounts`}
            </p>
          </article>
        </section>

        {/* QUICK ACTIONS */}
        <section className="admin-quick-actions">
          <div className="admin-section-heading">
            <h2>Quick Actions</h2>
            <p>
              Manage staff accounts and access the directory.
            </p>
          </div>

          <div className="admin-action-grid">
            <button
              type="button"
              className="admin-action-card"
              onClick={openCreateStaff}
            >
              <span
                className="admin-action-icon"
                aria-hidden="true"
              >
                +
              </span>

              <strong>Create Staff Account</strong>

              <span>
                Register a new Employee or Manager.
              </span>
            </button>

            <button
              type="button"
              className="admin-action-card"
              onClick={openStaffManagement}
            >
              <span
                className="admin-action-icon"
                aria-hidden="true"
              >
                ≡
              </span>

              <strong>Staff Management</strong>

              <span>
                Search, edit, activate, or deactivate employees.
              </span>
            </button>
          </div>
        </section>

        {/* STAFF DIRECTORY PREVIEW */}
        <section className="manager-requests-card admin-staff-section">
          <div className="manager-card-header">
            <div>
              <h2>Recently Registered Staff</h2>

              <p>
                A preview of the latest staff account IDs.
              </p>
            </div>

            <button
              type="button"
              className="admin-view-all"
              onClick={openStaffManagement}
            >
              View All
            </button>
          </div>

          <div className="manager-table-wrapper">
            <table className="manager-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="admin-table-message"
                    >
                      Loading staff accounts...
                    </td>
                  </tr>
                ) : recentStaff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="admin-table-message"
                    >
                      No staff accounts available.
                    </td>
                  </tr>
                ) : (
                  recentStaff.map(member => (
                    <tr key={member.id}>
                      <td>
                        <strong>
                          {member.employeeNumber ||
                            `EMP-${String(member.id).padStart(3, '0')}`}
                        </strong>
                      </td>

                      <td>
                        {member.firstName} {member.lastName}
                      </td>

                      <td>
                        {member.jobTitle || 'Not assigned'}
                      </td>

                      <td>
                        <span className="status-badge">
                          {member.role}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            member.isActive
                              ? 'admin-status admin-status-active'
                              : 'admin-status admin-status-inactive'
                          }
                        >
                          {member.isActive
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard
