
import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

type LoginResponse = {
  message: string
  token: string
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
    role: string
  }
}

function getDashboardPath(role: string): string | null {
  switch (role.trim().toUpperCase()) {
    case 'CUSTOMER':
      return '/dashboard'

    case 'MANAGER':
      return '/manager/dashboard'

    case 'EMPLOYEE':
      return '/employee/dashboard'

    case 'ADMIN':
      return '/admin/dashboard'

    default:
      return null
  }
}

function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const response = await axios.post<LoginResponse>(
        'http://localhost:5255/api/Users/login',
        {
          email: email.trim(),
          password,
        }
      )

      const { token, user } = response.data

      if (!token || !user || typeof user.role !== 'string') {
        setError('Invalid login response from the server.')
        return
      }

      const dashboardPath = getDashboardPath(user.role)

      if (!dashboardPath) {
        setError('No dashboard is available for this account.')
        return
      }

      const normalizedUser = {
        ...user,
        role: user.role.trim().toUpperCase(),
      }

      localStorage.setItem('token', token)
      localStorage.setItem(
        'user',
        JSON.stringify(normalizedUser)
      )

      navigate(dashboardPath, { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.message

        setError(
          typeof serverMessage === 'string'
            ? serverMessage
            : 'Unable to sign in. Please check your credentials and try again.'
        )
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand">
          <div className="brand-icon">S</div>

          <div>
            <h1>SmartService</h1>
            <p>Service Management Platform</p>
          </div>
        </div>

        <div className="welcome">
          <h2>Welcome back</h2>
          <p>Sign in to manage your service requests.</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>

            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>

            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="register-link">
          Don't have an account?{' '}

          <button
            type="button"
            className="register-text-button"
            onClick={() => navigate('/register')}
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
