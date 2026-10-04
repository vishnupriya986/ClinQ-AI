import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AuthAside from '../components/AuthAside'
import { ApiError, apiRequest } from '../services/api'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password }),
      })
      navigate('/login', { replace: true, state: { notice: 'Your account is ready. Sign in to continue.' } })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to create your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Link to="/" className="auth-back"><ArrowLeft size={16} /> Back to home</Link>
        <div className="auth-brand"><span className="brand-mark"><UserRound size={20} /></span>ClinQ<span> AI</span></div>
        <div className="auth-form-wrap register-wrap">
          <div className="eyebrow"><span /> START YOUR JOURNEY</div>
          <h1>Create your<br />account.</h1>
          <p className="auth-intro">A private space for your health journey starts here.</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="fullName">Full name</label>
            <div className="input-wrap"><UserRound size={18} /><input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={100} value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Your name" /></div>
            <label htmlFor="email">Email address</label>
            <div className="input-wrap"><Mail size={18} /><input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></div>
            <label htmlFor="password">Password</label>
            <div className="input-wrap"><LockKeyhole size={18} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Create a strong password" /><button type="button" className="show-password" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <div className="password-hint"><Check size={14} /> At least 10 characters, including uppercase, lowercase, and a number</div>
            <label htmlFor="confirmPassword">Confirm password</label>
            <div className="input-wrap"><LockKeyhole size={18} /><input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></div>
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <><span className="spinner spinner-light" /> Creating account…</> : <>Create account <ArrowRight size={17} /></>}</button>
          </form>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
        <p className="auth-footnote">Your password is encrypted and your account is private by design.</p>
      </div>
      <AuthAside />
    </div>
  )
}
