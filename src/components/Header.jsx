import React from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [theme, setTheme] = React.useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('theme') || 'dark') : 'dark'
  )

  React.useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  return (
    <header className="container header">
      <div className="logo">MyVideo</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          className="nav-toggle"
          aria-label="메뉴 열기"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          ☰
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          aria-label="테마 전환"
          title="테마 전환"
        >
          {theme === 'light' ? '다크' : '라이트'}
        </button>
      </div>
      <nav className={`nav ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
        <a href="#features">Features</a>
        <a href="#video">Video</a>
        <a href="#contact">Contact</a>
      </nav>
    </header>
  )
}
