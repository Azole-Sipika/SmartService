
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import {
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import './CustomerDashboard.css'

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
  assignedEmployeeId: number | null
}

type Notification = {
  id: number
  ticketId: number
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

function getHeaders() {
  const token = localStorage.getItem('token')

  return {
    Authorization: `Bearer ${token}`,
  }
}

function CustomerDashboard() {
  const navigate = useNavigate()
  const location = useLocation()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [notifications, setNotifications] =
    useState<Notification[]>([])

  const [notificationsOpen, setNotificationsOpen] =
    useState(false)

  const [notificationsLoading, setNotificationsLoading] =
    useState(false)

  const [notificationsError, setNotificationsError] =
    useState('')

  const [markingRead, setMarkingRead] = useState(false)

  const storedUser = localStorage.getItem('user')
  const user: User | null = (() => {
    try {
      return storedUser ? (JSON.parse(storedUser) as User) : null
    } catch {
      return null
    }
  })()

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return true
      }

      return false
    },
    [navigate]
  )

  const loadNotifications = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    setNotificationsLoading(true)
    setNotificationsError('')

    try {
      const response = await axios.get<Notification[]>(
        `${API_URL}/Notifications`,
        {
          headers: getHeaders(),
        }
      )

      setNotifications(response.data)
    } catch (err) {
      if (!handleAuthError(err)) {
        setNotificationsError(
          'Unable to load notifications.'
        )
      }
    } finally {
      setNotificationsLoading(false)
    }
  }, [handleAuthError, navigate])

  useEffect(() => {
    const loadTickets = async () => {
      const token = localStorage.getItem('token')

      if (!token) {
        navigate('/login', { replace: true })
        return
      }

      try {
        setLoading(true)
        setError('')

        const response = await axios.get<Ticket[]>(
          `${API_URL}/Tickets`,
          {
            headers: getHeaders(),
          }
        )

        setTickets(response.data)
      } catch (err) {
        if (!handleAuthError(err)) {
          setError(
            'Unable to load your service requests.'
          )
        }
      } finally {
        setLoading(false)
      }
    }

    const timer = window.setTimeout(() => {
      void loadTickets()
      void loadNotifications()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [navigate, handleAuthError, loadNotifications])

  // Refresh notifications every 30 seconds.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (localStorage.getItem('token')) {
        void loadNotifications()
      }
    }, 30000)

    return () => window.clearInterval(interval)
  }, [loadNotifications])

  // Open My Requests when navigating to /dashboard#my-requests.
  useEffect(() => {
    if (location.hash !== '#my-requests') {
      return
    }

    document.getElementById('my-requests')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [location.hash, location.key])

  const unreadCount = notifications.filter(
    notification => !notification.isRead
  ).length

  const handleNotificationClick = async (
    notification: Notification
  ) => {
    if (!notification.isRead) {
      try {
        await axios.put(
          `${API_URL}/Notifications/${notification.id}/read`,
          {},
          {
            headers: getHeaders(),
          }
        )

        setNotifications(previous =>
          previous.map(item =>
            item.id === notification.id
              ? { ...item, isRead: true }
              : item
          )
        )
      } catch (err) {
        if (handleAuthError(err)) {
          return
        }

        setNotificationsError(
          'Unable to mark the notification as read.'
        )
        return
      }
    }

    setNotificationsOpen(false)
    navigate(`/tickets/${notification.ticketId}`)
  }

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      return
    }

    setMarkingRead(true)
    setNotificationsError('')

    try {
      await axios.put(
        `${API_URL}/Notifications/read-all`,
        {},
        {
          headers: getHeaders(),
        }
      )

      setNotifications(previous =>
        previous.map(notification => ({
          ...notification,
          isRead: true,
        }))
      )
    } catch (err) {
      if (!handleAuthError(err)) {
        setNotificationsError(
          'Unable to mark all notifications as read.'
        )
      }
    } finally {
      setMarkingRead(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  const openTickets = tickets.filter(
    ticket => ticket.status === 'OPEN'
  ).length

  const inProgressTickets = tickets.filter(
    ticket => ticket.status === 'IN_PROGRESS'
  ).length

  const resolvedTickets = tickets.filter(
    ticket => ticket.status === 'RESOLVED'
  ).length

  const isMyRequests =
    location.hash === '#my-requests'

  return (
    <div className="dashboard">
      {/* CUSTOMER SIDEBAR */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <div className="sidebar-logo">S</div>

            <div>
              <h2>SmartService</h2>
              <span>Customer Portal</span>
            </div>
          </div>

          <nav
            className="sidebar-nav"
            aria-label="Customer navigation"
          >
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `nav-item ${
                  isActive && !isMyRequests
                    ? 'active'
                    : ''
                }`
              }
              style={{ textDecoration: 'none' }}
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/dashboard#my-requests"
              className={
                `nav-item ${isMyRequests ? 'active' : ''}`
              }
              style={{ textDecoration: 'none' }}
            >
              My Requests
            </NavLink>

            <NavLink
              to="/tickets/new"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              style={{ textDecoration: 'none' }}
            >
              New Request
            </NavLink>

            <NavLink
              to="/customer/profile"
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              style={{ textDecoration: 'none' }}
            >
              My Profile
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <ThemeToggle />

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="page-label">
              CUSTOMER PORTAL
            </p>

            <h1>
              Welcome back,{' '}
              {user?.firstName ?? 'Customer'}
            </h1>

            <p>
              Track and manage your service requests
              from one place.
            </p>
          </div>

          <div className="customer-header-actions">
            {/* NOTIFICATIONS */}
            <div className="customer-notification-wrapper">
              <button
                type="button"
                className="customer-notification-bell"
                aria-label={
                  `Notifications, ${unreadCount} unread`
                }
                aria-expanded={notificationsOpen}
                onClick={() => {
                  const nextOpen = !notificationsOpen
                  setNotificationsOpen(nextOpen)

                  if (nextOpen) {
                    void loadNotifications()
                  }
                }}
              >
                <span className="customer-bell-icon">
                  🔔
                </span>

                {unreadCount > 0 && (
                  <span className="customer-notification-count">
                    {unreadCount > 99
                      ? '99+'
                      : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="customer-notification-panel">
                  <div className="customer-notification-header">
                    <div>
                      <h3>Notifications</h3>
                      <p>{unreadCount} unread</p>
                    </div>

                    <button
                      type="button"
                      className="customer-mark-all"
                      onClick={() =>
                        void handleMarkAllAsRead()
                      }
                      disabled={
                        markingRead ||
                        unreadCount === 0
                      }
                    >
                      {markingRead
                        ? 'Updating...'
                        : 'Mark all as read'}
                    </button>
                  </div>

                  {notificationsError && (
                    <p className="customer-notification-error">
                      {notificationsError}
                    </p>
                  )}

                  {notificationsLoading &&
                    notifications.length === 0 && (
                      <p className="customer-notification-empty">
                        Loading notifications...
                      </p>
                    )}

                  {!notificationsLoading &&
                    notifications.length === 0 && (
                      <p className="customer-notification-empty">
                        No notifications yet.
                      </p>
                    )}

                  <div className="customer-notification-list">
                    {notifications.map(notification => (
                      <button
                        type="button"
                        key={notification.id}
                        className={
                          `customer-notification-item ${
                            notification.isRead
                              ? 'read'
                              : 'unread'
                          }`
                        }
                        onClick={() =>
                          void handleNotificationClick(
                            notification
                          )
                        }
                      >
                        <span className="customer-notification-item-icon">
                          {notification.type === 'COMMENT'
                            ? '💬'
                            : '📋'}
                        </span>

                        <span className="customer-notification-item-content">
                          <strong>
                            {notification.title}
                          </strong>

                          <span>
                            {notification.message}
                          </span>

                          <small>
                            {new Date(
                              notification.createdAt
                            ).toLocaleString()}
                          </small>
                        </span>

                        {!notification.isRead && (
                          <span className="customer-unread-dot" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CUSTOMER PROFILE */}
            <div className="user-profile">
              <div className="user-avatar">
                {user?.firstName?.charAt(0) ?? 'C'}
              </div>

              <div>
                <strong>
                  {user?.firstName}{' '}
                  {user?.lastName}
                </strong>

                <span>{user?.email}</span>
              </div>
            </div>
          </div>
        </header>

        {/* STATISTICS */}
        <section className="stats-grid">
          <article className="stat-card">
            <span className="stat-label">
              Open Requests
            </span>

            <strong>{openTickets}</strong>

            <span className="stat-description">
              Waiting for assistance
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">
              In Progress
            </span>

            <strong>{inProgressTickets}</strong>

            <span className="stat-description">
              Currently being handled
            </span>
          </article>

          <article className="stat-card">
            <span className="stat-label">
              Resolved
            </span>

            <strong>{resolvedTickets}</strong>

            <span className="stat-description">
              Completed requests
            </span>
          </article>

          <article className="stat-card total-card">
            <span className="stat-label">
              Total Requests
            </span>

            <strong>{tickets.length}</strong>

            <span className="stat-description">
              All service requests
            </span>
          </article>
        </section>

        {/* SERVICE REQUESTS */}
        <section
          className="requests-card"
          id="my-requests"
          style={{ scrollMarginTop: '24px' }}
        >
          <div className="requests-header">
            <div>
              <h2>My Service Requests</h2>
              <p>
                View and track your recent requests.
              </p>
            </div>

            <button
              type="button"
              className="new-request-button"
              onClick={() =>
                navigate('/tickets/new')
              }
            >
              + New Service Request
            </button>
          </div>

          {loading && (
            <div className="dashboard-message">
              Loading requests...
            </div>
          )}

          {error && (
            <div className="dashboard-error">
              {error}
            </div>
          )}

          {!loading &&
            !error &&
            tickets.length === 0 && (
              <div className="dashboard-message">
                You haven't created any service
                requests yet.
              </div>
            )}

          {!loading &&
            !error &&
            tickets.length > 0 && (
              <div className="table-wrapper">
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Title</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tickets.map(ticket => (
                      <tr key={ticket.id}>
                        <td>
                          <button
                            type="button"
                            className="ticket-number ticket-link customer-ticket-link-button"
                            onClick={() =>
                              navigate(
                                `/tickets/${ticket.id}`
                              )
                            }
                          >
                            #{ticket.id}
                          </button>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="ticket-title ticket-link customer-ticket-link-button"
                            onClick={() =>
                              navigate(
                                `/tickets/${ticket.id}`
                              )
                            }
                          >
                            {ticket.title}
                          </button>
                        </td>

                        <td>
                          <span
                            className={
                              `priority priority-${ticket.priority.toLowerCase()}`
                            }
                          >
                            {ticket.priority}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              `status status-${ticket.status
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

                        <td>
                          {new Date(
                            ticket.createdAt
                          ).toLocaleDateString()}
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

export default CustomerDashboard
