import { useState } from 'react'
import { Activity, ClipboardList, LogOut, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setSignOutError('Unable to sign out right now. Check your connection and try again.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/dashboard" className="brand">
          <span className="brand-mark"><Activity size={21} strokeWidth={2.5} /></span>
          <span>ClinQ<span className="brand-ai"> AI</span><small>HEALTH COMPANION</small></span>
        </NavLink>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavLink to="/dashboard"><Activity size={18} />Overview</NavLink>
          <NavLink to="/new-prediction"><Plus size={18} />New prediction</NavLink>
          <NavLink to="/history"><ClipboardList size={18} />History</NavLink>
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={19} />
          <p>Your health information is private and secured.</p>
        </div>
        <div className="sidebar-user">
          <div className="avatar"><UserRound size={18} /></div>
          <div className="user-meta"><strong>{user?.fullName}</strong><span>{user?.email}</span></div>
          <button className="icon-button" onClick={handleSignOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Activity size={19} /></span>ClinQ AI</div>
          <div className="topbar-right">
            <span className="secure-label"><ShieldCheck size={15} /> Private workspace</span>
            <span className="topbar-avatar">{user?.fullName.slice(0, 1).toUpperCase()}</span>
            <button className="icon-button mobile-logout" onClick={handleSignOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </div>
        </header>
        {signOutError && <p className="signout-error" role="alert">{signOutError}</p>}
        <div className="content-area"><Outlet /></div>
        <footer className="app-disclaimer">For educational purposes only. Not a substitute for professional medical advice.</footer>
      </main>
    </div>
  )
}
