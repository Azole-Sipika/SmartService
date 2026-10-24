

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import {
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

import './ManagerDashboard.css'
import './EmployeesPage.css'

const API_URL = 'http://localhost:5255/api'

const positions = [
  'Technician',
  'Developer',
  'IT Support',
  'Business Analyst',
  'HR',
  'Cleaner',
  'Manager',
  'Administrator',
  'Other',
]

type Employee = {
  id: number
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  role: string
  jobTitle: string | null
  isActive: boolean
}

type EditForm = {
  firstName: string
  lastName: string
  email: string
  jobTitle: string
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type RoleFilter = 'ALL' | 'EMPLOYEE' | 'MANAGER'
type StaffRole = 'EMPLOYEE' | 'MANAGER'

function getStoredRole(): string {
  try {
    const user: unknown = JSON.parse(
      localStorage.getItem('user') || '{}'
    )

    if (
      user &&
      typeof user === 'object' &&
      'role' in user &&
      typeof user.role === 'string'
    ) {
      return user.role.trim().toUpperCase()
    }

    return ''
  } catch {
    return ''
  }
}

function EmployeesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const createStaffRef = useRef<HTMLElement | null>(null)

  const isAdmin = getStoredRole() === 'ADMIN'

  const dashboardPath = isAdmin
    ? '/admin/dashboard'
    : '/manager/dashboard'

  const employeesPath = isAdmin
    ? '/admin/employees'
    : '/manager/employees'

  const [employees, setEmployees] = useState<Employee[]>([])
  const [listLoading, setListLoading] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [accountRole, setAccountRole] =
    useState<StaffRole>('EMPLOYEE')

  const [editingEmployee, setEditingEmployee] =
    useState<Employee | null>(null)

  const [editForm, setEditForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL')
  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>('ALL')
  const [positionFilter, setPositionFilter] = useState('ALL')

  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  })

  const handleApiError = useCallback((
    err: unknown,
    fallback: string
  ) => {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return
      }

      if (err.response?.status === 403) {
        setError(
          'You do not have permission to perform this action.'
        )
        return
      }

      const message = err.response?.data?.message

      setError(
        typeof message === 'string' ? message : fallback
      )
      return
    }

    setError(fallback)
  }, [navigate])

  const loadEmployees = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      navigate('/login', { replace: true })
      return
    }

    try {
      const response = await axios.get<Employee[]>(
        `${API_URL}/Users/employees`,
        {
          headers: {
            Authorization:
              `Bearer ${localStorage.getItem('token')}`,
          },
        }
      )

      setEmployees(response.data)
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 401
      ) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
      } else {
        handleApiError(
          err,
          'Unable to load staff accounts.'
        )
      }
    } finally {
      setListLoading(false)
    }
  }, [navigate, handleApiError])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEmployees()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadEmployees])

  /*
    When the Admin Dashboard sends the user to
    /admin/employees#create-staff, scroll directly
    to the existing staff creation form.
  */
  useEffect(() => {
    if (!isAdmin || location.hash !== '#create-staff') {
      return
    }

    const section = createStaffRef.current

    if (!section) return

    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [isAdmin, location.hash, location.key])

  const employeeOnly = useMemo(
    () =>
      employees.filter(
        employee =>
          employee.role.toUpperCase() === 'EMPLOYEE'
      ),
    [employees]
  )

  const totalEmployees = employeeOnly.length

  const activeEmployees = employeeOnly.filter(
    employee => employee.isActive
  ).length

  const inactiveEmployees =
    totalEmployees - activeEmployees

  const availablePositions = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map(employee => employee.jobTitle?.trim())
          .filter(
            (title): title is string => Boolean(title)
          )
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [employees])

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()

    return employees.filter(employee => {
      const fullName =
        `${employee.firstName} ${employee.lastName}`
          .toLowerCase()

      const searchableText = [
        fullName,
        employee.email,
        employee.employeeNumber ?? '',
        employee.jobTitle ?? '',
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        query === '' || searchableText.includes(query)

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && employee.isActive) ||
        (statusFilter === 'INACTIVE' && !employee.isActive)

      const matchesRole =
        roleFilter === 'ALL' ||
        employee.role.toUpperCase() === roleFilter

      const matchesPosition =
        positionFilter === 'ALL' ||
        (positionFilter === 'UNASSIGNED'
          ? !employee.jobTitle?.trim()
          : employee.jobTitle === positionFilter)

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRole &&
        matchesPosition
      )
    })
  }, [
    employees,
    search,
    statusFilter,
    roleFilter,
    positionFilter,
  ])

  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'ALL' ||
    roleFilter !== 'ALL' ||
    positionFilter !== 'ALL'

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('ALL')
    setRoleFilter('ALL')
    setPositionFilter('ALL')
  }

  const handleCreateEmployee = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!isAdmin) {
      setError(
        'Only administrators can create staff accounts.'
      )
      return
    }

    setError('')
    setSuccess('')

    if (!jobTitle) {
      setError('Please select a job position.')
      return
    }

    setLoading(true)

    try {
      const endpoint =
        accountRole === 'MANAGER'
          ? `${API_URL}/Users/register-manager`
          : `${API_URL}/Users/register-employee`

      await axios.post(
        endpoint,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          jobTitle,
        },
        { headers: getHeaders() }
      )

      setSuccess(
        accountRole === 'MANAGER'
          ? 'Manager account created successfully.'
          : 'Employee account created successfully.'
      )

      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setJobTitle('')
      setAccountRole('EMPLOYEE')

      await loadEmployees()
    } catch (err) {
      handleApiError(
        err,
        'Unable to create staff account.'
      )
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (employee: Employee) => {
    if (employee.role.toUpperCase() !== 'EMPLOYEE') {
      return
    }

    setEditingEmployee(employee)

    setEditForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      jobTitle: employee.jobTitle ?? '',
    })

    setError('')
    setSuccess('')
  }

  const handleSaveEmployee = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!editingEmployee) return

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await axios.put(
        `${API_URL}/Employees/${editingEmployee.id}`,
        editForm,
        { headers: getHeaders() }
      )

      setEditingEmployee(null)

      setSuccess(
        'Employee details updated successfully.'
      )

      await loadEmployees()
    } catch (err) {
      handleApiError(
        err,
        'Unable to update employee.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleAccountStatus = async (
    employee: Employee
  ) => {
    if (employee.role.toUpperCase() !== 'EMPLOYEE') {
      return
    }

    const action = employee.isActive
      ? 'deactivate'
      : 'activate'

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ` +
      `${employee.firstName} ${employee.lastName}?`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')
    setActionId(employee.id)

    try {
      await axios.put(
        `${API_URL}/Employees/${employee.id}/${action}`,
        {},
        { headers: getHeaders() }
      )

      setSuccess(
        `Employee account ${
          employee.isActive
            ? 'deactivated'
            : 'reactivated'
        } successfully.`
      )

      await loadEmployees()
    } catch (err) {
      handleApiError(
        err,
        `Unable to ${action} employee.`
      )
    } finally {
      setActionId(null)
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
    `manager-nav-item ${isActive ? 'active' : ''}`

  return (
    <div className="manager-dashboard">
      {/* SIDEBAR */}
      <aside className="manager-sidebar">
        <div>
          <div className="manager-brand">
            <div className="manager-logo">S</div>

            <div>
              <h2>SmartService</h2>
              <p>
                {isAdmin
                  ? 'Admin Portal'
                  : 'Manager Portal'}
              </p>
            </div>
          </div>

          <nav
            className="manager-nav"
            aria-label={
              isAdmin
                ? 'Admin navigation'
                : 'Manager navigation'
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

            {isAdmin ? (
              <>
                <NavLink
                  to={employeesPath}
                  end
                  className={navClassName}
                  style={{ textDecoration: 'none' }}
                >
                  Staff Management
                </NavLink>

                <NavLink
                  to={`${employeesPath}#create-staff`}
                  className={({ isActive }) =>
                    `manager-nav-item ${
                      isActive &&
                      location.hash === '#create-staff'
                        ? 'active'
                        : ''
                    }`
                  }
                  style={{ textDecoration: 'none' }}
                >
                  Create Staff Account
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to={employeesPath}
                  end
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
              </>
            )}
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
              STAFF MANAGEMENT
            </p>

            <h1>
              {isAdmin
                ? 'Staff Management'
                : 'Employees'}
            </h1>

            <p>
              {isAdmin
                ? 'Create, search, filter and manage SmartService staff accounts.'
                : 'Search, filter and manage SmartService employees.'}
            </p>
          </div>
        </header>

        {/* EMPLOYEE SUMMARY */}
        <section className="employee-summary-grid">
          <article className="employee-summary-card">
            <span>Total Employees</span>
            <strong>{totalEmployees}</strong>
          </article>

          <article className="employee-summary-card">
            <span>Active Employees</span>
            <strong>{activeEmployees}</strong>
          </article>

          <article className="employee-summary-card">
            <span>Inactive Employees</span>
            <strong>{inactiveEmployees}</strong>
          </article>
        </section>

        {error && (
          <p
            className="employee-form-error"
            role="alert"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            className="employee-form-success"
            role="status"
          >
            {success}
          </p>
        )}

        {/* ADMIN-ONLY STAFF CREATION */}
        {isAdmin && (
          <section
            id="create-staff"
            ref={createStaffRef}
            className="manager-requests-card"
            style={{
              scrollMarginTop: '24px',
              marginBottom: '28px',
            }}
          >
            <div className="manager-card-header">
              <div>
                <h2>Create Staff Account</h2>
                <p>
                  Create an Employee or Manager account.
                </p>
              </div>
            </div>

            <form
              className="employee-create-form"
              onSubmit={handleCreateEmployee}
            >
              <div className="employee-form-group">
                <label htmlFor="firstName">
                  First name
                </label>

                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={event =>
                    setFirstName(event.target.value)
                  }
                  autoComplete="given-name"
                  required
                />
              </div>

              <div className="employee-form-group">
                <label htmlFor="lastName">
                  Last name
                </label>

                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={event =>
                    setLastName(event.target.value)
                  }
                  autoComplete="family-name"
                  required
                />
              </div>

              <div className="employee-form-group">
                <label htmlFor="employeeEmail">
                  Email
                </label>

                <input
                  id="employeeEmail"
                  type="email"
                  value={email}
                  onChange={event =>
                    setEmail(event.target.value)
                  }
                  autoComplete="off"
                  required
                />
              </div>

              <div className="employee-form-group">
                <label htmlFor="employeePassword">
                  Temporary password
                </label>

                <input
                  id="employeePassword"
                  type="password"
                  value={password}
                  onChange={event =>
                    setPassword(event.target.value)
                  }
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="employee-form-group">
                <label htmlFor="accountRole">
                  Account Access
                </label>

                <select
                  id="accountRole"
                  value={accountRole}
                  onChange={event => {
                    const role =
                      event.target.value as StaffRole

                    setAccountRole(role)

                    setJobTitle(
                      role === 'MANAGER'
                        ? 'Manager'
                        : ''
                    )
                  }}
                >
                  <option value="EMPLOYEE">
                    Employee
                  </option>

                  <option value="MANAGER">
                    Manager
                  </option>
                </select>
              </div>

              <div className="employee-form-group">
                <label htmlFor="jobTitle">
                  Job Position
                </label>

                <select
                  id="jobTitle"
                  value={jobTitle}
                  onChange={event =>
                    setJobTitle(event.target.value)
                  }
                  disabled={accountRole === 'MANAGER'}
                  required
                >
                  <option value="">
                    Select a position
                  </option>

                  {positions.map(position => (
                    <option
                      key={position}
                      value={position}
                    >
                      {position}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="manager-assign-button"
                disabled={loading}
              >
                {loading
                  ? 'Creating Account...'
                  : accountRole === 'MANAGER'
                    ? 'Create Manager'
                    : 'Create Employee'}
              </button>
            </form>
          </section>
        )}

        {/* STAFF DIRECTORY */}
        <section
          id="staff-directory"
          className="manager-requests-card"
        >
          <div className="manager-card-header">
            <div>
              <h2>Staff Accounts</h2>
              <p>
                Search and filter your staff records.
              </p>
            </div>
          </div>

          {/* FILTERS */}
          <div className="employee-filters">
            <div className="employee-search-field">
              <label htmlFor="employee-search">
                Search Employees
              </label>

              <div className="employee-search-input-wrap">
                <span aria-hidden="true">⌕</span>

                <input
                  id="employee-search"
                  type="search"
                  placeholder="Search name, email, ID or position..."
                  value={search}
                  onChange={event =>
                    setSearch(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="employee-filter-grid">
              <div className="employee-filter-field">
                <label htmlFor="employee-status-filter">
                  Status
                </label>

                <select
                  id="employee-status-filter"
                  value={statusFilter}
                  onChange={event =>
                    setStatusFilter(
                      event.target.value as StatusFilter
                    )
                  }
                >
                  <option value="ALL">
                    All statuses
                  </option>
                  <option value="ACTIVE">
                    Active
                  </option>
                  <option value="INACTIVE">
                    Inactive
                  </option>
                </select>
              </div>

              <div className="employee-filter-field">
                <label htmlFor="employee-role-filter">
                  Account Role
                </label>

                <select
                  id="employee-role-filter"
                  value={roleFilter}
                  onChange={event =>
                    setRoleFilter(
                      event.target.value as RoleFilter
                    )
                  }
                >
                  <option value="ALL">
                    All roles
                  </option>
                  <option value="EMPLOYEE">
                    Employee
                  </option>
                  <option value="MANAGER">
                    Manager
                  </option>
                </select>
              </div>

              <div className="employee-filter-field">
                <label htmlFor="employee-position-filter">
                  Job Position
                </label>

                <select
                  id="employee-position-filter"
                  value={positionFilter}
                  onChange={event =>
                    setPositionFilter(event.target.value)
                  }
                >
                  <option value="ALL">
                    All positions
                  </option>

                  <option value="UNASSIGNED">
                    Not assigned
                  </option>

                  {availablePositions.map(position => (
                    <option
                      key={position}
                      value={position}
                    >
                      {position}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="employee-filter-footer">
              <p aria-live="polite">
                Showing{' '}
                <strong>
                  {filteredEmployees.length}
                </strong>{' '}
                of{' '}
                <strong>
                  {employees.length}
                </strong>{' '}
                staff accounts
              </p>

              <button
                type="button"
                className="employee-clear-filters"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* STAFF TABLE */}
          <div className="manager-table-wrapper">
            <table className="manager-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Email</th>
                  <th>System Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={7}>
                      Loading staff accounts...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="employee-empty-state"
                    >
                      <strong>
                        {employees.length === 0
                          ? 'No staff accounts found.'
                          : 'No matching employees found.'}
                      </strong>

                      {employees.length > 0 && (
                        <p>
                          Try another search or clear
                          your filters.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(employee => (
                    <tr key={employee.id}>
                      <td>
                        <strong>
                          {employee.employeeNumber ??
                            `EMP-${employee.id
                              .toString()
                              .padStart(3, '0')}`}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {employee.firstName}{' '}
                          {employee.lastName}
                        </strong>
                      </td>

                      <td>
                        {employee.jobTitle ??
                          'Not assigned'}
                      </td>

                      <td>{employee.email}</td>

                      <td>
                        <span className="status-badge">
                          {employee.role}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`employee-account-status ${
                            employee.isActive
                              ? 'employee-active'
                              : 'employee-inactive'
                          }`}
                        >
                          {employee.isActive
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        {employee.role.toUpperCase() ===
                        'EMPLOYEE' ? (
                          <div className="employee-action-buttons">
                            <button
                              type="button"
                              className="employee-edit-button"
                              onClick={() =>
                                openEdit(employee)
                              }
                              disabled={
                                actionId !== null ||
                                loading
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className={
                                employee.isActive
                                  ? 'employee-deactivate-button'
                                  : 'employee-activate-button'
                              }
                              disabled={
                                actionId !== null ||
                                loading
                              }
                              onClick={() =>
                                handleAccountStatus(employee)
                              }
                            >
                              {actionId === employee.id
                                ? 'Updating...'
                                : employee.isActive
                                  ? 'Deactivate'
                                  : 'Reactivate'}
                            </button>
                          </div>
                        ) : (
                          <span className="employee-manager-note">
                            Manager account
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* EDIT EMPLOYEE MODAL */}
        {editingEmployee && (
          <div className="employee-modal-overlay">
            <div
              className="employee-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="employee-edit-title"
            >
              <h2 id="employee-edit-title">
                Edit Employee
              </h2>

              <p>
                {editingEmployee.employeeNumber} —{' '}
                {editingEmployee.firstName}{' '}
                {editingEmployee.lastName}
              </p>

              <form onSubmit={handleSaveEmployee}>
                <div className="employee-form-group">
                  <label htmlFor="editFirstName">
                    First name
                  </label>

                  <input
                    id="editFirstName"
                    type="text"
                    value={editForm.firstName}
                    onChange={event =>
                      setEditForm(previous => ({
                        ...previous,
                        firstName: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="employee-form-group">
                  <label htmlFor="editLastName">
                    Last name
                  </label>

                  <input
                    id="editLastName"
                    type="text"
                    value={editForm.lastName}
                    onChange={event =>
                      setEditForm(previous => ({
                        ...previous,
                        lastName: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="employee-form-group">
                  <label htmlFor="editEmail">
                    Email
                  </label>

                  <input
                    id="editEmail"
                    type="email"
                    value={editForm.email}
                    onChange={event =>
                      setEditForm(previous => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="employee-form-group">
                  <label htmlFor="editJobTitle">
                    Job Position
                  </label>

                  <select
                    id="editJobTitle"
                    value={editForm.jobTitle}
                    onChange={event =>
                      setEditForm(previous => ({
                        ...previous,
                        jobTitle: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">
                      Select a position
                    </option>

                    {editForm.jobTitle &&
                      !positions.includes(
                        editForm.jobTitle
                      ) && (
                        <option
                          value={editForm.jobTitle}
                        >
                          {editForm.jobTitle}
                        </option>
                      )}

                    {positions.map(position => (
                      <option
                        key={position}
                        value={position}
                      >
                        {position}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="employee-modal-actions">
                  <button
                    type="button"
                    className="employee-cancel-button"
                    onClick={() =>
                      setEditingEmployee(null)
                    }
                    disabled={loading}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="manager-assign-button"
                    disabled={loading}
                  >
                    {loading
                      ? 'Saving...'
                      : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default EmployeesPage
