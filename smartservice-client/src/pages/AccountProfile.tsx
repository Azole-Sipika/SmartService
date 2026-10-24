
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import './AccountProfile.css'

const API_URL = 'http://localhost:5255'

type AccountRole = 'CUSTOMER' | 'MANAGER'

type Account = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: AccountRole
  jobTitle: string | null
  isActive: boolean
  createdAt: string
}

type UpdateResponse = {
  message: string
  firstName: string
  lastName: string
}

type MessageResponse = {
  message: string
}

type Props = {
  role: AccountRole
}

async function apiRequest<T>(
  path: string,
  method = 'GET',
  body?: object
): Promise<T> {
  const token = localStorage.getItem('token')

  if (!token) {
    throw new Error('Please log in again.')
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const data: unknown = await response
    .json()
    .catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        'Your session has expired. Please log in again.'
      )
    }

    if (response.status === 403) {
      throw new Error(
        'You do not have permission to access this profile.'
      )
    }

    let message = `Request failed (${response.status})`

    if (
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string'
    ) {
      message = data.message
    }

    throw new Error(message)
  }

  return data as T
}

function AccountProfile({ role }: Props) {
  const navigate = useNavigate()

  const isManager = role === 'MANAGER'

  const dashboardPath = isManager
    ? '/manager/dashboard'
    : '/dashboard'

  const profilePath = isManager
    ? '/manager/profile'
    : '/customer/profile'

  const [account, setAccount] = useState<Account | null>(
    null
  )

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [currentPassword, setCurrentPassword] =
    useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] =
    useState(false)

  const [loadError, setLoadError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] =
    useState('')

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      try {
        setLoading(true)
        setLoadError('')

        const data = await apiRequest<Account>(
          '/api/account-profile/me'
        )

        if (cancelled) return

        if (data.role !== role) {
          setLoadError(
            'This profile does not belong to your account role.'
          )
          return
        }

        setAccount(data)
        setFirstName(data.firstName)
        setLastName(data.lastName)
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load your profile.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [role])

  const handleUpdateProfile = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setProfileError('')
    setProfileMessage('')

    const first = firstName.trim()
    const last = lastName.trim()

    if (!first || !last) {
      setProfileError(
        'First name and last name are required.'
      )
      return
    }

    if (first.length > 100 || last.length > 100) {
      setProfileError(
        'Names cannot exceed 100 characters.'
      )
      return
    }

    try {
      setSaving(true)

      const result = await apiRequest<UpdateResponse>(
        '/api/account-profile/me',
        'PUT',
        {
          firstName: first,
          lastName: last,
        }
      )

      setAccount(previous =>
        previous
          ? {
              ...previous,
              firstName: result.firstName,
              lastName: result.lastName,
            }
          : previous
      )

      setFirstName(result.firstName)
      setLastName(result.lastName)

      const storedUser = localStorage.getItem('user')

      if (storedUser) {
        try {
          const user = JSON.parse(storedUser)

          localStorage.setItem(
            'user',
            JSON.stringify({
              ...user,
              firstName: result.firstName,
              lastName: result.lastName,
            })
          )
        } catch {
          // Ignore invalid local storage data.
        }
      }

      setProfileMessage(result.message)
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : 'Unable to update profile.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setPasswordError('')
    setPasswordMessage('')

    if (!currentPassword) {
      setPasswordError(
        'Enter your current password.'
      )
      return
    }

    if (
      newPassword.length < 8 ||
      newPassword.length > 128
    ) {
      setPasswordError(
        'New password must be between 8 and 128 characters.'
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        'New passwords do not match.'
      )
      return
    }

    if (newPassword === currentPassword) {
      setPasswordError(
        'Choose a different password.'
      )
      return
    }

    try {
      setChangingPassword(true)

      const result = await apiRequest<MessageResponse>(
        '/api/account-profile/change-password',
        'PUT',
        {
          currentPassword,
          newPassword,
          confirmPassword,
        }
      )

      setPasswordMessage(result.message)

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : 'Unable to change password.'
      )
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    navigate('/login', { replace: true })
  }

  const navClassName = ({
    isActive,
  }: {
    isActive: boolean
  }) =>
    `account-portal-nav-item ${
      isActive ? 'active' : ''
    }`

  return (
    <div
      className={`account-portal-layout ${role.toLowerCase()}-portal`}
    >
      {/* SIDEBAR */}
      <aside className="account-portal-sidebar">
        <div>
          <div className="account-portal-brand">
            <div className="account-portal-logo">
              S
            </div>

            <div>
              <h2>SmartService</h2>

              <span>
                {isManager
                  ? 'Manager Portal'
                  : 'Customer Portal'}
              </span>
            </div>
          </div>

          <nav
            className="account-portal-nav"
            aria-label={
              isManager
                ? 'Manager navigation'
                : 'Customer navigation'
            }
          >
            <NavLink
              to={dashboardPath}
              end
              className={navClassName}
              style={{ textDecoration: 'none' }}
            >
              Dashboard
            </NavLink>

            {isManager ? (
              <>
                <NavLink
                  to="/manager/analytics"
                  className={navClassName}
                  style={{ textDecoration: 'none' }}
                >
                  Analytics
                </NavLink>

                <NavLink
                  to="/manager/dashboard#manager-service-requests"
                  className="account-portal-nav-item"
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
              </>
            ) : (
              <NavLink
                to="/tickets/new"
                className={navClassName}
                style={{ textDecoration: 'none' }}
              >
                New Service Request
              </NavLink>
            )}

            <NavLink
              to={profilePath}
              end
              className={navClassName}
              style={{ textDecoration: 'none' }}
            >
              My Profile
            </NavLink>
          </nav>
        </div>

        <div className="account-portal-sidebar-bottom">
          <ThemeToggle />

          <button
            type="button"
            className="account-portal-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* PROFILE MAIN CONTENT */}
      <main className="account-profile-page">
        <div className="account-profile-container">
          {loading ? (
            <section
              className="account-profile-card account-profile-wait"
              role="status"
              aria-live="polite"
            >
              <span
                className="account-profile-spinner"
                aria-hidden="true"
              />

              <p>Loading your profile...</p>
            </section>
          ) : !account ? (
            <section className="account-profile-card">
              <p
                className="account-profile-error"
                role="alert"
              >
                {loadError || 'Profile unavailable.'}
              </p>

              <button
                type="button"
                className="account-profile-back"
                onClick={() => navigate(dashboardPath)}
              >
                ← Back to Dashboard
              </button>
            </section>
          ) : (
            <>
              <button
                type="button"
                className="account-profile-back"
                onClick={() => navigate(dashboardPath)}
              >
                ← Back to Dashboard
              </button>

              {/* PROFILE HEADER */}
              <header className="account-profile-header">
                <div>
                  <p className="account-profile-eyebrow">
                    SMARTSERVICE / {role} PORTAL
                  </p>

                  <h1>My Profile</h1>

                  <p>
                    Manage your personal information and
                    account security.
                  </p>
                </div>

                <span className="account-profile-status">
                  {account.isActive
                    ? 'Active'
                    : 'Inactive'}
                </span>
              </header>

              {/* ACCOUNT IDENTITY */}
              <section className="account-profile-card account-profile-identity">
                <div className="account-profile-avatar">
                  {account.firstName
                    .charAt(0)
                    .toUpperCase()}
                  {account.lastName
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <h2>
                    {account.firstName}{' '}
                    {account.lastName}
                  </h2>

                  <p>
                    {isManager
                      ? 'Manager'
                      : 'Customer'}
                  </p>

                  <span>
                    Account #{account.id}
                  </span>
                </div>
              </section>

              {/* PERSONAL INFORMATION */}
              <section className="account-profile-card">
                <h2>Personal Information</h2>

                <p className="account-profile-description">
                  Update your name. Your email and
                  account role cannot be changed here.
                </p>

                {profileMessage && (
                  <p
                    className="account-profile-success"
                    role="status"
                  >
                    {profileMessage}
                  </p>
                )}

                {profileError && (
                  <p
                    className="account-profile-error"
                    role="alert"
                  >
                    {profileError}
                  </p>
                )}

                <form onSubmit={handleUpdateProfile}>
                  <div className="account-profile-grid">
                    <div className="account-profile-field">
                      <label htmlFor="account-first-name">
                        First Name
                      </label>

                      <input
                        id="account-first-name"
                        type="text"
                        value={firstName}
                        onChange={event =>
                          setFirstName(
                            event.target.value
                          )
                        }
                        maxLength={100}
                        autoComplete="given-name"
                        required
                      />
                    </div>

                    <div className="account-profile-field">
                      <label htmlFor="account-last-name">
                        Last Name
                      </label>

                      <input
                        id="account-last-name"
                        type="text"
                        value={lastName}
                        onChange={event =>
                          setLastName(
                            event.target.value
                          )
                        }
                        maxLength={100}
                        autoComplete="family-name"
                        required
                      />
                    </div>

                    <div className="account-profile-field">
                      <label htmlFor="account-email">
                        Email Address
                      </label>

                      <input
                        id="account-email"
                        type="email"
                        value={account.email}
                        readOnly
                      />
                    </div>

                    <div className="account-profile-field">
                      <label htmlFor="account-role">
                        Account Role
                      </label>

                      <input
                        id="account-role"
                        value={account.role}
                        readOnly
                      />
                    </div>

                    <div className="account-profile-field">
                      <label htmlFor="account-created">
                        Member Since
                      </label>

                      <input
                        id="account-created"
                        value={new Date(
                          account.createdAt
                        ).toLocaleDateString('en-ZA')}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="account-profile-actions">
                    <button
                      type="submit"
                      disabled={saving}
                    >
                      {saving
                        ? 'Saving...'
                        : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </section>

              {/* ACCOUNT SECURITY */}
              <section className="account-profile-card">
                <h2>Account Security</h2>

                <p className="account-profile-description">
                  Change your password to keep your
                  account secure.
                </p>

                {passwordMessage && (
                  <p
                    className="account-profile-success"
                    role="status"
                  >
                    {passwordMessage}
                  </p>
                )}

                {passwordError && (
                  <p
                    className="account-profile-error"
                    role="alert"
                  >
                    {passwordError}
                  </p>
                )}

                <form onSubmit={handleChangePassword}>
                  <div className="account-profile-password-fields">
                    <div className="account-profile-field">
                      <label htmlFor="account-current-password">
                        Current Password
                      </label>

                      <input
                        id="account-current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={event =>
                          setCurrentPassword(
                            event.target.value
                          )
                        }
                        required
                      />
                    </div>

                    <div className="account-profile-field">
                      <label htmlFor="account-new-password">
                        New Password
                      </label>

                      <input
                        id="account-new-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={newPassword}
                        onChange={event =>
                          setNewPassword(
                            event.target.value
                          )
                        }
                        required
                      />
                    </div>

                    <div className="account-profile-field">
                      <label htmlFor="account-confirm-password">
                        Confirm New Password
                      </label>

                      <input
                        id="account-confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={event =>
                          setConfirmPassword(
                            event.target.value
                          )
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="account-profile-actions">
                    <button
                      type="submit"
                      disabled={changingPassword}
                    >
                      {changingPassword
                        ? 'Updating Password...'
                        : 'Update Password'}
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default AccountProfile
