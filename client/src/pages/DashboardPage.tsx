import { useEffect, useState } from 'react'
import { Activity, ArrowRight, ClipboardCheck, ClipboardList, FileText, HeartPulse, History, MessageCircle, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ApiError, apiRequest } from '../services/api'
import type { DashboardSummary } from '../types'

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadSummary() {
    setLoading(true)
    setError('')
    try {
      setSummary(await apiRequest<DashboardSummary>('/api/dashboard'))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to load your dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSummary() }, [])

  return (
    <div className="dashboard-page">
      <div className="welcome-row">
        <div><div className="eyebrow"><span /> YOUR PERSONAL HEALTHSPACE</div><h1>Good to see you,<br /><em>{user?.fullName.split(' ')[0]}.</em></h1><p>A little more clarity can make a meaningful difference.</p></div>
        <div className="welcome-icon"><HeartPulse size={34} strokeWidth={1.5} /></div>
      </div>
      <section className="dashboard-hero">
        <div className="hero-copy-small"><span className="hero-chip"><Sparkles size={13} /> YOUR SPACE, YOUR PACE</span><h2>Your health journey<br />starts with a question.</h2><p>Save a health intake using your clinical information, or review older research-model estimates in your history.</p><span className="workspace-ready"><ShieldCheck size={15} /> Your secure workspace is active</span></div>
        <div className="hero-decoration"><span className="hero-arc arc-a" /><span className="hero-arc arc-b" /><span className="hero-heart"><HeartPulse size={70} strokeWidth={1.2} /></span><span className="hero-spark"><Sparkles size={23} /></span></div>
      </section>
      <section className="dashboard-actions" aria-label="Prediction and history">
        <Link to="/new-prediction" className="dashboard-action primary-action"><span><Plus size={20} /></span><div><b>New prediction</b><small>Save your heart, lung, or diabetes clinical intake</small></div><ArrowRight size={17} /></Link>
        <Link to="/history" className="dashboard-action"><span><History size={20} /></span><div><b>History</b><small>View results and continue prediction chats</small></div><ArrowRight size={17} /></Link>
      </section>
      <div className="section-title-row"><div><h2>Your workspace</h2><p>Information saved to your account</p></div><span className="live-status"><span /> PRIVATE & SECURE</span></div>
      {error && <div className="error-banner dashboard-error" role="alert">{error} <button onClick={() => void loadSummary()}>Try again</button></div>}
      <section className="summary-grid" aria-label="Workspace summary">
        <SummaryCard icon={<ClipboardCheck size={19} />} label="Clinical assessments" value={summary?.counts.intakes} loading={loading} description="Synthetic model score; not clinical risk" tint="mint" />
        <SummaryCard icon={<ClipboardList size={19} />} label="Previous estimates" value={summary?.counts.predictions} loading={loading} description="Older research model results" tint="lavender" />
        <SummaryCard icon={<MessageCircle size={19} />} label="Conversations" value={summary?.counts.conversations} loading={loading} description="Your assistant chats" tint="lavender" />
        <SummaryCard icon={<FileText size={19} />} label="Health documents" value={summary?.counts.medicalFiles} loading={loading} description="Reports in your workspace" tint="peach" />
      </section>
      <section className="getting-started">
        <div className="getting-icon"><Activity size={20} /></div>
        <div className="getting-copy"><h3>Clinical assessments and previous predictions</h3><p>New assessments include an experimental score from synthetic data. It is not a real-world disease risk estimate. Older UCI research predictions retain their original inputs, results, and chats.</p></div>
        <div className="getting-badge"><ShieldCheck size={16} /> Private account</div>
      </section>
      <section className="disclaimer-card"><ShieldCheck size={17} /><p>This application provides AI-assisted health information and risk assessment for educational and informational purposes. It is not intended to diagnose, treat, cure, or prevent any disease and does not replace professional medical advice, diagnosis, or treatment. Consult a qualified healthcare professional for medical decisions.</p></section>
    </div>
  )
}

function SummaryCard({ icon, label, value, loading, description, tint }: { icon: ReactNode; label: string; value?: number; loading: boolean; description: string; tint: string }) {
  return <article className="summary-card"><div className={`summary-icon ${tint}`}>{icon}</div><div className="summary-label">{label}</div><div className="summary-value">{loading ? <span className="skeleton-number" /> : value ?? '—'}</div><div className="summary-description">{description}</div></article>
}
