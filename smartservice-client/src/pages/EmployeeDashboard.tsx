
import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import './EmployeeDashboard.css'

const API_URL = 'http://localhost:5255/api'

type User = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
}

type Ticket = {
  id: number
  title: string
  description: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  customerId: number
  customerName?: string
  customerEmail?: string
  assignedEmployeeId: number | null
}

function EmployeeDashboard() {
  const navigate = useNavigate()
  const location = useLocation()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const storedUser = localStorage.getItem('user')

  const user: User | null = (() => {
    try {
      return storedUser ? (JSON.parse(storedUser) as User) : null
    } catch {
      return null
    }
  })()

  // Load tickets assigned to the logged-in employee.
  useEffect(() => {
    const loadAssignedTickets = async () => {
      const token = localStorage.getItem('token')

      if (!token) {
        navigate('/login', { replace: true })
        return
      }

      try {
        setLoading(true)
        setError('')

        const response = await axios.get<Ticket[]>(
          `${API_URL}/Tickets/assigned`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        setTickets(response.data)
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')

            navigate('/login', { replace: true })
            return
          }

          if (err.response?.status === 403) {
            setError(
              'You do not have permission to access employee requests.'
            )
            return
          }
        }

        setError(
          'Unable to load your assigned requests.'
        )
      } finally {
        setLoading(false)
      }
    }

    void loadAssignedTickets()
  }, [navigate])

  // Scroll to Assigned Requests when the URL has its hash.
  useEffect(() => {
    if (
      location.hash !== '#assigned-requests'
    ) {
      return
    }

    document
      .getElementById('assigned-requests')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }, [location.hash, location.key])

  // Open the selected ticket.
  const handleOpenTicket = (ticketId: number) => {
    navigate(`/tickets/${ticketId}`)
  }

  // Log out of the employee portal.
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    navigate('/login', { replace: true })
  }

  // Ticket statistics.
  const inProgressCount = tickets.filter(
    ticket => ticket.status === 'IN_PROGRESS'
  ).length

  const resolvedCount = tickets.filter(
    ticket => ticket.status === 'RESOLVED'
  ).length

  const isAssignedRequests =
    location.hash === '#assigned-requests'

  return (
    <div className="employee-dashboard">
      {/* EMPLOYEE SIDEBAR */}
      <aside className="employee-sidebar">
        <div>
          <div className="employee-brand">
            <div className="employee-logo">
              S
            </div>

            <div>
              <h2>SmartService</h2>
              <span>Employee Portal</span>
            </div>
          </div>

          <nav
            className="employee-nav"
            aria-label="Employee navigation"
          >
            <NavLink
              to="/employee/dashboard"
              end
              className={({ isActive }) =>
                `employee-nav-item ${
                  isActive && !isAssignedRequests
                    ? 'active'
                    : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/employee/dashboard#assigned-requests"
              className={
                `employee-nav-item ${
                  isAssignedRequests ? 'active' : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              Assigned Requests
            </NavLink>

            <NavLink
              to="/employee/profile"
              className={({ isActive }) =>
                `employee-nav-item ${
                  isActive ? 'active' : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              My Profile
            </NavLink>
          </nav>
        </div>

        <div className="employee-sidebar-bottom">
          <ThemeToggle />

          <button
            type="button"
            className="employee-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="employee-main">
        {/* HEADER */}
        <header className="employee-header">
          <div>
            <p className="employee-page-label">
              EMPLOYEE PORTAL
            </p>

            <h1>
              Welcome back,{' '}
              {user?.firstName ?? 'Employee'}
            </h1>

            <p>
              View and manage service requests
              assigned to you.
            </p>
          </div>

          <div className="employee-profile">
            <div className="employee-avatar">
              {user?.firstName?.charAt(0) ?? 'E'}
            </div>

            <div>
              <strong>
                {user?.firstName}{' '}
                {user?.lastName}
              </strong>

              <span>{user?.email}</span>
            </div>
          </div>
        </header>

        {/* EMPLOYEE STATISTICS */}
        <section className="employee-stats">
          <article className="employee-stat-card">
            <span>Assigned Requests</span>

            <strong>
              {tickets.length}
            </strong>

            <p>
              Total assigned to you
            </p>
          </article>

          <article className="employee-stat-card">
            <span>In Progress</span>

            <strong>
              {inProgressCount}
            </strong>

            <p>
              Currently being handled
            </p>
          </article>

          <article className="employee-stat-card">
            <span>Resolved</span>

            <strong>
              {resolvedCount}
            </strong>

            <p>
              Completed requests
            </p>
          </article>
        </section>

        {/* ASSIGNED SERVICE REQUESTS */}
        <section
          id="assigned-requests"
          className="employee-requests-card"
          style={{
            scrollMarginTop: '24px',
          }}
        >
          <div className="employee-card-header">
            <div>
              <h2>My Assigned Requests</h2>

              <p>
                Select a request to view its details.
              </p>
            </div>

            <span className="employee-ticket-count">
              {tickets.length} requests
            </span>
          </div>

          {/* LOADING STATE */}
          {loading && (
            <div
              className="employee-message"
              role="status"
            >
              Loading assigned requests...
            </div>
          )}

          {/* ERROR STATE */}
          {error && (
            <div
              className="employee-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* EMPTY STATE */}
          {!loading &&
            !error &&
            tickets.length === 0 && (
              <div className="employee-message">
                You don't have any assigned requests yet.
              </div>
            )}

          {/* ASSIGNED REQUESTS TABLE */}
          {!loading &&
            !error &&
            tickets.length > 0 && (
              <div className="employee-table-wrapper">
                <table className="employee-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Title</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tickets.map(ticket => (
                      <tr key={ticket.id}>
                        {/* TICKET ID */}
                        <td>
                          <strong>
                            #{ticket.id}
                          </strong>
                        </td>

                        {/* TICKET TITLE */}
                        <td>
                          <strong>
                            {ticket.title}
                          </strong>

                          <div className="employee-description">
                            {ticket.description}
                          </div>
                        </td>

                        {/* PRIORITY */}
                        <td>
                          <span
                            className={
                              `employee-priority employee-priority-${ticket.priority.toLowerCase()}`
                            }
                          >
                            {ticket.priority}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td>
                          <span
                            className={
                              `employee-status employee-status-${ticket.status
                                .toLowerCase()
                                .replaceAll('_', '-')}`
                            }
                          >
                            {ticket.status.replaceAll(
                              '_',
                              ' '
                            )}
                          </span>
                        </td>

                        {/* DATE CREATED */}
                        <td>
                          {new Date(
                            ticket.createdAt
                          ).toLocaleDateString()}
                        </td>

                        {/* ACTION */}
                        <td>
                          <button
                            type="button"
                            className="employee-view-button"
                            onClick={() =>
                              handleOpenTicket(
                                ticket.id
                              )
                            }
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </main>
    </div>
  )
}

export default EmployeeDashboard
