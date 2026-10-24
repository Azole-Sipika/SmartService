
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import './ManagerDashboard.css'

const API_URL = 'http://localhost:5255'

type Ticket = {
  id: number
  title: string
  description: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  customerId: number
  customerName: string
  customerEmail: string
  assignedEmployeeId: number | null
  assignedEmployeeName: string | null
  assignedEmployeeIsActive?: boolean | null
}

type Employee = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  isActive: boolean
}

type User = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
}

function ManagerDashboard() {
  const navigate = useNavigate()
  const location = useLocation()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState('')

  const [selectedEmployees, setSelectedEmployees] =
    useState<Record<number, string>>({})

  const [assigningTicketId, setAssigningTicketId] =
    useState<number | null>(null)

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User)
      } catch {
        localStorage.removeItem('user')
      }
    }

    try {
      setError('')

      const headers = {
        Authorization: `Bearer ${token}`,
      }

      const [ticketsResponse, employeesResponse] =
        await Promise.all([
          axios.get<Ticket[]>(
            `${API_URL}/api/Tickets/manager/all`,
            { headers }
          ),
          axios.get<Employee[]>(
            `${API_URL}/api/Users/employees`,
            { headers }
          ),
        ])

      setTickets(ticketsResponse.data)
      setEmployees(employeesResponse.data)
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
            'You do not have permission to access the Manager Dashboard.'
          )
          return
        }
      }

      setError('Unable to load the Manager Dashboard.')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  // Scroll to Service Requests when the URL contains its hash.
  useEffect(() => {
    if (
      location.hash !== '#manager-service-requests' ||
      loading
    ) {
      return
    }

    document
      .getElementById('manager-service-requests')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
  }, [location.hash, location.key, loading])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  const handleEmployeeChange = (
    ticketId: number,
    employeeId: string
  ) => {
    setSelectedEmployees(current => ({
      ...current,
      [ticketId]: employeeId,
    }))

    setError('')
    setAssignmentMessage('')
  }

  const handleAssign = async (ticket: Ticket) => {
    const employeeId = selectedEmployees[ticket.id]
    const token = localStorage.getItem('token')

    if (!employeeId) {
      setError('Please select an employee first.')
      return
    }

    const employee = employees.find(
      item => item.id === Number(employeeId)
    )

    if (!employee || employee.isActive !== true) {
      setError('Please select an active employee.')
      return
    }

    if (ticket.assignedEmployeeId === employee.id) {
      setError(
        'This ticket is already assigned to that employee.'
      )
      return
    }

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    try {
      setError('')
      setAssignmentMessage('')
      setAssigningTicketId(ticket.id)

      const response = await axios.put<{
        message?: string
      }>(
        `${API_URL}/api/Tickets/${ticket.id}/assign/${employee.id}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setAssignmentMessage(
        response.data.message ||
          `Ticket #${ticket.id} updated successfully.`
      )

      setSelectedEmployees(current => {
        const updated = { ...current }
        delete updated[ticket.id]
        return updated
      })

      await loadDashboard()
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
            'You do not have permission to assign this ticket.'
          )
          return
        }

        const message = (
          err.response?.data as
            | { message?: string }
            | undefined
        )?.message

        if (message) {
          setError(message)
          return
        }
      }

      setError('Unable to update ticket assignment.')
    } finally {
      setAssigningTicketId(null)
    }
  }

  const activeEmployees = employees.filter(
    employee =>
      employee.role === 'EMPLOYEE' &&
      employee.isActive === true
  )

  const openCount = tickets.filter(
    ticket => ticket.status === 'OPEN'
  ).length

  const inProgressCount = tickets.filter(
    ticket => ticket.status === 'IN_PROGRESS'
  ).length

  const resolvedCount = tickets.filter(
    ticket => ticket.status === 'RESOLVED'
  ).length

  const inactiveAssignmentCount = tickets.filter(
    ticket =>
      ticket.assignedEmployeeId !== null &&
      ticket.assignedEmployeeIsActive === false
  ).length

  const isServiceRequestsPage =
    location.hash === '#manager-service-requests'

  return (
    <div className="manager-dashboard">
      {/* SIDEBAR */}
      <aside className="manager-sidebar">
        <div>
          <div className="manager-brand">
            <div className="manager-logo">S</div>

            <div>
              <h2>SmartService</h2>
              <p>Manager Portal</p>
            </div>
          </div>

          <nav
            className="manager-nav"
            aria-label="Manager navigation"
          >
            <NavLink
              to="/manager/dashboard"
              end
              className={({ isActive }) =>
                `manager-nav-item ${
                  isActive && !isServiceRequestsPage
                    ? 'active'
                    : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/manager/analytics"
              className={({ isActive }) =>
                `manager-nav-item ${
                  isActive ? 'active' : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              Analytics
            </NavLink>

            <NavLink
              to="/manager/dashboard#manager-service-requests"
              className={() =>
                `manager-nav-item ${
                  isServiceRequestsPage ? 'active' : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              Service Requests
            </NavLink>

            <NavLink
              to="/manager/employees"
              className={({ isActive }) =>
                `manager-nav-item ${
                  isActive ? 'active' : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              Employees
            </NavLink>

            <NavLink
              to="/manager/profile"
              className={({ isActive }) =>
                `manager-nav-item ${
                  isActive ? 'active' : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              My Profile
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
              MANAGER PORTAL
            </p>

            <h1>Manager Dashboard</h1>

            <p>
              Manage service requests and employee assignments.
            </p>
          </div>

          <div className="manager-profile">
            <div className="manager-avatar">
              {user?.firstName?.charAt(0) || 'M'}
            </div>

            <div>
              <strong>
                {user
                  ? `${user.firstName} ${user.lastName}`
                  : 'Manager'}
              </strong>

              <span>{user?.email}</span>
            </div>
          </div>
        </header>

        {loading ? (
          <section
            className="manager-content-loading"
            role="status"
            aria-live="polite"
          >
            <span
              className="manager-loading-spinner"
              aria-hidden="true"
            />

            <p>Loading Manager Dashboard...</p>
          </section>
        ) : (
          <>
            {error && (
              <div
                className="manager-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {assignmentMessage && (
              <div
                className="manager-success"
                role="status"
              >
                {assignmentMessage}
              </div>
            )}

            {inactiveAssignmentCount > 0 && (
              <div
                className="manager-inactive-alert"
                role="alert"
              >
                <strong>
                  Assignment attention needed
                </strong>

                <p>
                  {inactiveAssignmentCount}{' '}
                  {inactiveAssignmentCount === 1
                    ? 'ticket is'
                    : 'tickets are'}{' '}
                  assigned to deactivated employees.
                  Reassign them to active staff members.
                </p>
              </div>
            )}

            {/* DASHBOARD STATISTICS */}
            <section className="manager-stats">
              <article className="manager-stat-card">
                <span>Open</span>
                <strong>{openCount}</strong>
                <p>Waiting for assignment</p>
              </article>

              <article className="manager-stat-card">
                <span>In Progress</span>
                <strong>{inProgressCount}</strong>
                <p>Currently being handled</p>
              </article>

              <article className="manager-stat-card">
                <span>Resolved</span>
                <strong>{resolvedCount}</strong>
                <p>Completed requests</p>
              </article>

              <article className="manager-stat-card">
                <span>Total</span>
                <strong>{tickets.length}</strong>
                <p>All service requests</p>
              </article>
            </section>

            {/* SERVICE REQUESTS */}
            <section
              id="manager-service-requests"
              className="manager-requests-card"
              style={{ scrollMarginTop: '24px' }}
            >
              <div className="manager-card-header">
                <div>
                  <h2>Service Requests</h2>

                  <p>
                    View requests, assign active employees,
                    and reassign existing tickets.
                  </p>
                </div>

                <span className="manager-ticket-count">
                  {tickets.length} requests
                </span>
              </div>

              {tickets.length === 0 ? (
                <div className="manager-empty">
                  No service requests found.
                </div>
              ) : (
                <div className="manager-table-wrapper">
                  <table className="manager-table">
                    <thead>
                      <tr>
                        <th>Request</th>
                        <th>Customer</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Assigned To</th>
                      </tr>
                    </thead>

                    <tbody>
                      {tickets.map(ticket => {
                        const isAssigned =
                          ticket.assignedEmployeeId !== null

                        const isInactive =
                          isAssigned &&
                          ticket.assignedEmployeeIsActive === false

                        const selectedEmployeeId =
                          selectedEmployees[ticket.id] || ''

                        const isAssigning =
                          assigningTicketId === ticket.id

                        const isSameEmployee =
                          selectedEmployeeId !== '' &&
                          Number(selectedEmployeeId) ===
                            ticket.assignedEmployeeId

                        return (
                          <tr
                            key={ticket.id}
                            className={
                              isInactive
                                ? 'manager-ticket-inactive-row'
                                : ''
                            }
                          >
                            <td>
                              <strong>
                                #{ticket.id}
                              </strong>

                              <div>
                                {ticket.title}
                              </div>
                            </td>

                            <td>
                              <strong>
                                {ticket.customerName}
                              </strong>

                              <div>
                                {ticket.customerEmail}
                              </div>
                            </td>

                            <td>
                              <span
                                className={`manager-priority manager-priority-${ticket.priority.toLowerCase()}`}
                              >
                                {ticket.priority}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`manager-status manager-status-${ticket.status
                                  .toLowerCase()
                                  .replaceAll('_', '-')}`}
                              >
                                {ticket.status.replaceAll(
                                  '_',
                                  ' '
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="manager-assignment-cell">
                                {isAssigned ? (
                                  <div
                                    className={
                                      isInactive
                                        ? 'manager-assigned-employee manager-assigned-inactive'
                                        : 'manager-assigned-employee'
                                    }
                                  >
                                    <span className="manager-assigned-dot">
                                      {isInactive
                                        ? '!'
                                        : '✓'}
                                    </span>

                                    <span>
                                      {ticket.assignedEmployeeName ||
                                        'Unknown employee'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="manager-unassigned-label">
                                    Not assigned
                                  </span>
                                )}

                                {isInactive && (
                                  <span className="manager-inactive-warning">
                                    Employee deactivated —
                                    reassignment required
                                  </span>
                                )}

                                <div className="manager-assignment">
                                  <select
                                    aria-label={`Select employee for ticket ${ticket.id}`}
                                    value={selectedEmployeeId}
                                    onChange={event =>
                                      handleEmployeeChange(
                                        ticket.id,
                                        event.target.value
                                      )
                                    }
                                    disabled={
                                      isAssigning ||
                                      assigningTicketId !== null
                                    }
                                  >
                                    <option value="">
                                      {isAssigned
                                        ? 'Select new employee'
                                        : 'Select employee'}
                                    </option>

                                    {activeEmployees
                                      .filter(
                                        employee =>
                                          employee.id !==
                                          ticket.assignedEmployeeId
                                      )
                                      .map(employee => (
                                        <option
                                          key={employee.id}
                                          value={employee.id}
                                        >
                                          {employee.firstName}{' '}
                                          {employee.lastName}
                                        </option>
                                      ))}
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleAssign(
                                        ticket
                                      )
                                    }
                                    disabled={
                                      !selectedEmployeeId ||
                                      isSameEmployee ||
                                      assigningTicketId !== null
                                    }
                                  >
                                    {isAssigning
                                      ? isAssigned
                                        ? 'Reassigning...'
                                        : 'Assigning...'
                                      : isAssigned
                                        ? 'Reassign'
                                        : 'Assign'}
                                  </button>
                                </div>

                                {activeEmployees.length === 0 && (
                                  <small className="manager-assignment-help">
                                    No active employees available.
                                  </small>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default ManagerDashboard
