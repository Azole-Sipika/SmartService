
import { useState } from 'react'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  try {
    const savedTheme = localStorage.getItem('theme')
    return savedTheme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  const toggleTheme = () => {
    const nextTheme: Theme =
      theme === 'light' ? 'dark' : 'light'

    document.documentElement.setAttribute(
      'data-theme',
      nextTheme
    )

    try {
      localStorage.setItem('theme', nextTheme)
    } catch {
      // Theme remains active for this session.
    }

    setTheme(nextTheme)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Change theme"
    >
      {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
    </button>
  )
}

export default ThemeToggle
