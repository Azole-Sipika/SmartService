
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import './EmployeeProfile.css'

const API_URL = 'http://localhost:5255'

type Employee = {
  id: number
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  role: string
  jobTitle: string | null
  isActive: boolean
  createdAt: string
}

type UpdateProfileResponse = {
  message: string
  id: number
  firstName: string
  lastName: string
}

type MessageResponse = {
  message: string
}

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  if (!token) {
    throw new Error('Please log in again.')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({}))

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

    throw new Error(
      data.message || `Request failed (${response.status})`
    )
  }

  return data as T
}

function EmployeeProfile() {
  const navigate = useNavigate()

  const [employee, setEmployee] = useState<Employee | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [profileMessage, setProfileMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loadingError, setLoadingError] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      if (!getToken()) {
        navigate('/login', { replace: true })
        return
      }

      try {
        setLoading(true)
        setLoadingError('')

        const data = await apiRequest<Employee>(
          '/api/employee-profile/me'
        )

        if (cancelled) return

        setEmployee(data)
        setFirstName(data.firstName)
        setLastName(data.lastName)
      } catch (error) {
        if (cancelled) return

        setLoadingError(
          error instanceof Error
            ? error.message
            : 'Unable to load employee profile.'
        )
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
  }, [navigate])

  const handleUpdateProfile = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setProfileError('')
    setProfileMessage('')

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    if (!trimmedFirstName || !trimmedLastName) {
      setProfileError('First name and last name are required.')
      return
    }

    if (
      trimmedFirstName.length > 100 ||
      trimmedLastName.length > 100
    ) {
      setProfileError(
        'First name and last name cannot exceed 100 characters.'
      )
      return
    }

    try {
      setSaving(true)

      const updated = await apiRequest<UpdateProfileResponse>(
        '/api/employee-profile/me',
        {
          method: 'PUT',
          body: JSON.stringify({
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
          }),
        }
      )

      setEmployee(previous =>
        previous
          ? {
              ...previous,
              firstName: updated.firstName,
              lastName: updated.lastName,
            }
          : previous
      )

      setFirstName(updated.firstName)
      setLastName(updated.lastName)

      const storedUser = localStorage.getItem('user')

      if (storedUser) {
        try {
          const currentUser = JSON.parse(storedUser)

          localStorage.setItem(
            'user',
            JSON.stringify({
              ...currentUser,
              firstName: updated.firstName,
              lastName: updated.lastName,
            })
          )
        } catch {
          // Ignore invalid local storage data.
        }
      }

      setProfileMessage('Profile updated successfully.')
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
      setPasswordError('Please enter your current password.')
      return
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError(
        'New password must contain between 8 and 128 characters.'
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        'Your new password must be different from your current password.'
      )
      return
    }

    try {
      setChangingPassword(true)

      const result = await apiRequest<MessageResponse>(
        '/api/employee-profile/change-password',
        {
          method: 'PUT',
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        }
      )

      setPasswordMessage(
        result.message || 'Password changed successfully.'
      )

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

  return (
    <div className="employee-profile-layout">
      <aside className="employee-profile-sidebar">
        <div>
          <div className="employee-profile-brand">
            <div className="employee-profile-logo">S</div>

            <div>
              <h2>SmartService</h2>
              <p>Employee Portal</p>
            </div>
          </div>

          <nav
            className="employee-profile-nav"
            aria-label="Employee navigation"
          >
            <button
              type="button"
              className="employee-profile-nav-item"
              onClick={() => navigate('/employee/dashboard')}
            >
              Dashboard
            </button>

            <button
              type="button"
              className="employee-profile-nav-item active"
              aria-current="page"
            >
              My Profile
            </button>
          </nav>
        </div>

        <div className="employee-profile-sidebar-bottom">
          <ThemeToggle />

          <button
            type="button"
            className="employee-profile-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="employee-profile-page">
        <div className="employee-profile-container">
          {loading ? (
            <section
              className="profile-card employee-profile-loading-card"
              role="status"
              aria-live="polite"
            >
              <span
                className="employee-profile-spinner"
                aria-hidden="true"
              />
              <p>Loading employee profile...</p>
            </section>
          ) : !employee ? (
            <section className="profile-card">
              <div
                className="profile-alert profile-error"
                role="alert"
              >
                {loadingError || 'Employee profile unavailable.'}
              </div>

              <button
                type="button"
                className="profile-back-button"
                onClick={() => navigate('/employee/dashboard')}
              >
                ← Back to Dashboard
              </button>
            </section>
          ) : (
            <>
              <button
                type="button"
                className="profile-back-button"
                onClick={() => navigate('/employee/dashboard')}
              >
                ← Back to Dashboard
              </button>

              <header className="employee-profile-header">
                <div>
                  <p className="profile-eyebrow">
                    SMARTSERVICE / EMPLOYEE PORTAL
                  </p>

                  <h1>My Profile</h1>

                  <p>
                    Manage your personal information and account
                    security.
                  </p>
                </div>

                <span
                  className={
                    employee.isActive
                      ? 'profile-status active'
                      : 'profile-status inactive'
                  }
                >
                  {employee.isActive ? 'Active' : 'Inactive'}
                </span>
              </header>

              <section className="profile-card profile-identity">
                <div className="profile-avatar">
                  {employee.firstName.charAt(0).toUpperCase()}
                  {employee.lastName.charAt(0).toUpperCase()}
                </div>

                <div>
                  <h2>
                    {employee.firstName} {employee.lastName}
                  </h2>

                  <p>{employee.jobTitle || 'Employee'}</p>

                  <span>{employee.employeeNumber}</span>
                </div>
              </section>

              <section className="profile-card">
                <h2>Personal Information</h2>

                <p className="profile-section-description">
                  Update your personal details. Your email, job title,
                  and account role are managed by your administrator.
                </p>

                {profileMessage && (
                  <div
                    className="profile-alert profile-success"
                    role="status"
                  >
                    {profileMessage}
                  </div>
                )}

                {profileError && (
                  <div
                    className="profile-alert profile-error"
                    role="alert"
                  >
                    {profileError}
                  </div>
                )}

                <form onSubmit={handleUpdateProfile}>
                  <div className="profile-form-grid">
                    <div className="profile-field">
                      <label htmlFor="profile-first-name">
                        First Name
                      </label>
                      <input
                        id="profile-first-name"
                        type="text"
                        value={firstName}
                        maxLength={100}
                        onChange={event =>
                          setFirstName(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-last-name">
                        Last Name
                      </label>
                      <input
                        id="profile-last-name"
                        type="text"
                        value={lastName}
                        maxLength={100}
                        onChange={event =>
                          setLastName(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-email">
                        Email Address
                      </label>
                      <input
                        id="profile-email"
                        type="email"
                        value={employee.email}
                        readOnly
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-job-title">
                        Job Title
                      </label>
                      <input
                        id="profile-job-title"
                        type="text"
                        value={employee.jobTitle || 'Not assigned'}
                        readOnly
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-role">
                        Account Role
                      </label>
                      <input
                        id="profile-role"
                        type="text"
                        value={employee.role}
                        readOnly
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="profile-created">
                        Member Since
                      </label>
                      <input
                        id="profile-created"
                        type="text"
                        value={new Date(
                          employee.createdAt
                        ).toLocaleDateString()}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="profile-actions">
                    <button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="profile-card">
                <h2>Account Security</h2>

                <p className="profile-section-description">
                  Change your password to keep your SmartService
                  account secure.
                </p>

                {passwordMessage && (
                  <div
                    className="profile-alert profile-success"
                    role="status"
                  >
                    {passwordMessage}
                  </div>
                )}

                {passwordError && (
                  <div
                    className="profile-alert profile-error"
                    role="alert"
                  >
                    {passwordError}
                  </div>
                )}

                <form onSubmit={handleChangePassword}>
                  <div className="profile-password-fields">
                    <div className="profile-field">
                      <label htmlFor="current-password">
                        Current Password
                      </label>
                      <input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={event =>
                          setCurrentPassword(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="new-password">
                        New Password
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        value={newPassword}
                        onChange={event =>
                          setNewPassword(event.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="profile-field">
                      <label htmlFor="confirm-password">
                        Confirm New Password
                      </label>
                      <input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={event =>
                          setConfirmPassword(event.target.value)
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="profile-actions">
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

export default EmployeeProfile
