import { useState, type FormEvent } from 'react'
import { Activity, ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthAside from '../components/AuthAside'
import { ApiError, apiRequest } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh } = useAuth()
  const notice = (location.state as { notice?: string } | null)?.notice
  const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      await refresh()
      navigate(destination, { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/" className="auth-back"><ArrowLeft size={16} /> Back to home</Link>
        <div className="auth-brand"><span className="brand-mark"><Activity size={21} /></span>ClinQ<span> AI</span></div>
        <div className="auth-form-wrap">
          <div className="eyebrow"><span /> YOUR HEALTH, IN FOCUS</div>
          <h1>Welcome<br />back.</h1>
          <p className="auth-intro">Sign in to your private health workspace.</p>
          {notice && <div className="success-banner">{notice}</div>}
          {error && <div className="error-banner" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="email">Email address</label>
            <div className="input-wrap"><Mail size={18} /><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></div>
            <div className="label-row"><label htmlFor="password">Password</label><span>Secure sign in</span></div>
            <div className="input-wrap"><LockKeyhole size={18} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" className="show-password" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Signing in…</> : <>Sign in <ArrowRight size={17} /></>}</button>
          </form>
          <p className="auth-switch">New to ClinQ AI? <Link to="/register">Create an account</Link></p>
        </div>
        <p className="auth-footnote">By continuing, you agree to use ClinQ AI as an informational resource, not as a substitute for medical care.</p>
      </div>
      <AuthAside />
    </div>
  )
}
