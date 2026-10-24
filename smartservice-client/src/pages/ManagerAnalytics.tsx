
import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { NavLink, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

import './ManagerDashboard.css'
import './ManagerAnalytics.css'

const API_URL = 'http://localhost:5255'

type Ticket = {
  id: number
  title: string
  priority: string
  status: string
  createdAt: string
  updatedAt: string
  assignedEmployeeId: number | null
  assignedEmployeeName: string | null
  assignedEmployeeIsActive?: boolean | null
}

type Employee = {
  id: number
  firstName: string
  lastName: string
  role: string
  isActive: boolean
}

type Period = 'ALL' | '30' | '90' | '365'

const statusColors: Record<string, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#10b981',
}

const priorityColors: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
  CRITICAL: '#9333ea',
}

function formatLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function ManagerAnalytics() {
  const navigate = useNavigate()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>('ALL')

  const loadAnalytics = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setLoading(true)
    setError('')

    try {
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
            'You do not have permission to view analytics.'
          )
          return
        }
      }

      setError(
        'Unable to load analytics. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalytics()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAnalytics])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  const filteredTickets = useMemo(() => {
    if (period === 'ALL') {
      return tickets
    }

    const cutoff = new Date()
    cutoff.setDate(
      cutoff.getDate() - Number(period)
    )

    return tickets.filter(ticket => {
      const created = new Date(ticket.createdAt)

      return (
        !Number.isNaN(created.getTime()) &&
        created >= cutoff
      )
    })
  }, [tickets, period])

  const statistics = useMemo(() => {
    const total = filteredTickets.length

    const open = filteredTickets.filter(
      ticket => ticket.status === 'OPEN'
    ).length

    const inProgress = filteredTickets.filter(
      ticket => ticket.status === 'IN_PROGRESS'
    ).length

    const resolved = filteredTickets.filter(
      ticket => ticket.status === 'RESOLVED'
    ).length

    const unassigned = filteredTickets.filter(
      ticket => ticket.assignedEmployeeId == null
    ).length

    const inactiveAssignments = filteredTickets.filter(
      ticket =>
        ticket.assignedEmployeeId != null &&
        ticket.assignedEmployeeIsActive === false
    ).length

    const activeEmployees = employees.filter(
      employee =>
        employee.role === 'EMPLOYEE' &&
        employee.isActive
    ).length

    const resolutionRate =
      total > 0
        ? Math.round((resolved / total) * 100)
        : 0

    return {
      total,
      open,
      inProgress,
      resolved,
      unassigned,
      inactiveAssignments,
      activeEmployees,
      resolutionRate,
    }
  }, [filteredTickets, employees])

  const statusData = useMemo(() => {
    const counts = new Map<string, number>()

    filteredTickets.forEach(ticket => {
      const key = ticket.status.toUpperCase()

      counts.set(
        key,
        (counts.get(key) ?? 0) + 1
      )
    })

    const ordered = [
      'OPEN',
      'IN_PROGRESS',
      'RESOLVED',
    ]

    const statuses = [
      ...ordered,
      ...Array.from(counts.keys())
        .filter(key => !ordered.includes(key))
        .sort(),
    ]

    return statuses.map(status => ({
      name: formatLabel(status),
      count: counts.get(status) ?? 0,
      color: statusColors[status] ?? '#64748b',
    }))
  }, [filteredTickets])

  const priorityData = useMemo(() => {
    const counts = new Map<string, number>()

    filteredTickets.forEach(ticket => {
      const key = ticket.priority.toUpperCase()

      counts.set(
        key,
        (counts.get(key) ?? 0) + 1
      )
    })

    const ordered = [
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL',
    ]

    const priorities = [
      ...ordered,
      ...Array.from(counts.keys())
        .filter(key => !ordered.includes(key))
        .sort(),
    ]

    return priorities.map(priority => ({
      name: formatLabel(priority),
      count: counts.get(priority) ?? 0,
      color: priorityColors[priority] ?? '#64748b',
    }))
  }, [filteredTickets])

  const monthlyData = useMemo(() => {
    const now = new Date()

    const months = Array.from(
      { length: 6 },
      (_, index) => {
        const date = new Date(
          now.getFullYear(),
          now.getMonth() - (5 - index),
          1
        )

        return {
          year: date.getFullYear(),
          month: date.getMonth(),
          label: date.toLocaleString('en-ZA', {
            month: 'short',
          }),
          count: 0,
        }
      }
    )

    filteredTickets.forEach(ticket => {
      const date = new Date(ticket.createdAt)

      if (Number.isNaN(date.getTime())) {
        return
      }

      const month = months.find(
        item =>
          item.year === date.getFullYear() &&
          item.month === date.getMonth()
      )

      if (month) {
        month.count += 1
      }
    })

    return months
  }, [filteredTickets])

  const maxMonthlyCount = Math.max(
    1,
    ...monthlyData.map(item => item.count)
  )

  const maxPriorityCount = Math.max(
    1,
    ...priorityData.map(item => item.count)
  )

  const workloadData = useMemo(() => {
    const staff = employees.filter(
      employee => employee.role === 'EMPLOYEE'
    )

    const rows = staff.map(employee => {
      const assigned = filteredTickets.filter(
        ticket =>
          ticket.assignedEmployeeId === employee.id
      )

      const unresolved = assigned.filter(
        ticket => ticket.status !== 'RESOLVED'
      ).length

      return {
        id: employee.id,
        name:
          `${employee.firstName} ${employee.lastName}`,
        isActive: employee.isActive,
        total: assigned.length,
        unresolved,
        resolved: assigned.filter(
          ticket => ticket.status === 'RESOLVED'
        ).length,
      }
    })

    return rows.sort(
      (a, b) =>
        b.unresolved - a.unresolved ||
        b.total - a.total ||
        a.name.localeCompare(b.name)
    )
  }, [employees, filteredTickets])

  const periodLabel =
    period === 'ALL'
      ? 'All time'
      : `Last ${period} days`

  const navClassName = ({
    isActive,
  }: {
    isActive: boolean
  }) =>
    `manager-nav-item ${
      isActive ? 'active' : ''
    }`

  return (
    <div className="manager-dashboard manager-analytics">
      {/* SIDEBAR */}
      <aside className="manager-sidebar">
        <div>
          <div className="manager-brand">
            <div className="manager-logo">
              S
            </div>

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
              className={navClassName}
              style={{ textDecoration: 'none' }}
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/manager/analytics"
              className={navClassName}
              style={{ textDecoration: 'none' }}
            >
              Analytics
            </NavLink>

            <NavLink
              to="/manager/dashboard#manager-service-requests"
              className="manager-nav-item"
              style={{ textDecoration: 'none' }}
            >
              Service Requests
            </NavLink>

            <NavLink
              to="/manager/employees"
              className={navClassName}
              style={{ textDecoration: 'none' }}
            >
              Employees
            </NavLink>

            <NavLink
              to="/manager/profile"
              className={navClassName}
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
        <header className="manager-header analytics-header">
          <div>
            <p className="manager-page-label">
              MANAGER PORTAL
            </p>

            <h1>Analytics Dashboard</h1>

            <p>
              Monitor service requests and employee workload.
            </p>
          </div>

          <div className="analytics-header-actions">
            <label htmlFor="analytics-period">
              Reporting period
            </label>

            <select
              id="analytics-period"
              value={period}
              onChange={event =>
                setPeriod(
                  event.target.value as Period
                )
              }
            >
              <option value="ALL">
                All time
              </option>

              <option value="30">
                Last 30 days
              </option>

              <option value="90">
                Last 90 days
              </option>

              <option value="365">
                Last 365 days
              </option>
            </select>

            <button
              type="button"
              className="analytics-refresh"
              onClick={() => void loadAnalytics()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </header>

        {loading ? (
          <section
            className="manager-content-loading"
            role="status"
          >
            <span
              className="manager-loading-spinner"
              aria-hidden="true"
            />

            <p>Loading analytics...</p>
          </section>
        ) : error ? (
          <div
            className="manager-error"
            role="alert"
          >
            {error}
          </div>
        ) : (
          <>
            <div className="analytics-period-note">
              Ticket statistics: {periodLabel}.
              Employee totals reflect current account status.
            </div>

            {/* STATISTICS */}
            <section className="analytics-stats">
              <article className="analytics-stat-card">
                <span>Total Requests</span>
                <strong>
                  {statistics.total}
                </strong>
                <p>
                  Created during selected period
                </p>
              </article>

              <article className="analytics-stat-card">
                <span>Resolution Rate</span>
                <strong>
                  {statistics.resolutionRate}%
                </strong>
                <p>
                  {statistics.resolved} currently resolved
                </p>
              </article>

              <article className="analytics-stat-card">
                <span>Active Employees</span>
                <strong>
                  {statistics.activeEmployees}
                </strong>
                <p>
                  Currently active staff
                </p>
              </article>

              <article className="analytics-stat-card">
                <span>Unassigned Tickets</span>
                <strong>
                  {statistics.unassigned}
                </strong>
                <p>
                  Without an assigned employee
                </p>
              </article>
            </section>

            {statistics.inactiveAssignments > 0 && (
              <div
                className="manager-inactive-alert"
                role="alert"
              >
                <strong>
                  Assignment attention needed
                </strong>

                <p>
                  {statistics.inactiveAssignments} tickets
                  in this reporting period are assigned to
                  inactive employees.
                </p>
              </div>
            )}

            {/* CHARTS */}
            <section className="analytics-chart-grid">
              {/* MONTHLY REQUESTS */}
              <article className="analytics-panel">
                <div className="analytics-panel-heading">
                  <h2>
                    Monthly Service Requests
                  </h2>

                  <p>
                    Tickets created during the last six
                    calendar months
                  </p>
                </div>

                <div
                  className="analytics-month-chart"
                  role="img"
                  aria-label="Monthly service request counts"
                >
                  {monthlyData.map(item => (
                    <div
                      className="analytics-month"
                      key={`${item.year}-${item.month}`}
                    >
                      <span className="analytics-month-value">
                        {item.count}
                      </span>

                      <div className="analytics-month-track">
                        <div
                          className="analytics-month-bar"
                          style={{
                            height: `${
                              (item.count / maxMonthlyCount) *
                              100
                            }%`,
                          }}
                        />
                      </div>

                      <span className="analytics-month-label">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </article>

              {/* TICKET STATUS */}
              <article className="analytics-panel">
                <div className="analytics-panel-heading">
                  <h2>Ticket Status</h2>

                  <p>
                    Current status of selected requests
                  </p>
                </div>

                <div className="analytics-status-list">
                  {statusData.map(item => {
                    const percentage =
                      statistics.total > 0
                        ? Math.round(
                            (item.count /
                              statistics.total) *
                              100
                          )
                        : 0

                    return (
                      <div
                        className="analytics-progress-item"
                        key={item.name}
                      >
                        <div className="analytics-progress-label">
                          <span>
                            {item.name}
                          </span>

                          <strong>
                            {item.count} ({percentage}%)
                          </strong>
                        </div>

                        <div className="analytics-progress-track">
                          <div
                            className="analytics-progress-fill"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>

              {/* TICKETS BY PRIORITY */}
              <article className="analytics-panel">
                <div className="analytics-panel-heading">
                  <h2>
                    Tickets by Priority
                  </h2>

                  <p>
                    Priority distribution for selected
                    requests
                  </p>
                </div>

                <div className="analytics-status-list">
                  {priorityData.map(item => (
                    <div
                      className="analytics-progress-item"
                      key={item.name}
                    >
                      <div className="analytics-progress-label">
                        <span>
                          {item.name}
                        </span>

                        <strong>
                          {item.count}
                        </strong>
                      </div>

                      <div className="analytics-progress-track">
                        <div
                          className="analytics-progress-fill"
                          style={{
                            width: `${
                              (item.count /
                                maxPriorityCount) *
                              100
                            }%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              {/* REQUEST OVERVIEW */}
              <article className="analytics-panel">
                <div className="analytics-panel-heading">
                  <h2>Request Overview</h2>

                  <p>
                    Current ticket statuses for the
                    selected period
                  </p>
                </div>

                <div className="analytics-overview-list">
                  <div>
                    <span>Open Requests</span>
                    <strong>
                      {statistics.open}
                    </strong>
                  </div>

                  <div>
                    <span>In Progress</span>
                    <strong>
                      {statistics.inProgress}
                    </strong>
                  </div>

                  <div>
                    <span>Resolved Requests</span>
                    <strong>
                      {statistics.resolved}
                    </strong>
                  </div>

                  <div>
                    <span>Unassigned Requests</span>
                    <strong>
                      {statistics.unassigned}
                    </strong>
                  </div>
                </div>
              </article>
            </section>

            {/* EMPLOYEE WORKLOAD */}
            <section className="analytics-panel analytics-workload">
              <div className="analytics-panel-heading">
                <h2>Employee Workload</h2>

                <p>
                  Assigned requests by employee, based on
                  tickets created in the selected period
                </p>
              </div>

              <div className="manager-table-wrapper">
                <table className="manager-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Account Status</th>
                      <th>Assigned</th>
                      <th>Unresolved</th>
                      <th>Resolved</th>
                    </tr>
                  </thead>

                  <tbody>
                    {workloadData.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          No employee records available.
                        </td>
                      </tr>
                    ) : (
                      workloadData.map(employee => (
                        <tr key={employee.id}>
                          <td>
                            <strong>
                              {employee.name}
                            </strong>
                          </td>

                          <td>
                            <span
                              className={`analytics-employee-status ${
                                employee.isActive
                                  ? 'is-active'
                                  : 'is-inactive'
                              }`}
                            >
                              {employee.isActive
                                ? 'Active'
                                : 'Inactive'}
                            </span>
                          </td>

                          <td>
                            {employee.total}
                          </td>

                          <td>
                            {employee.unresolved}
                          </td>

                          <td>
                            {employee.resolved}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default ManagerAnalytics
