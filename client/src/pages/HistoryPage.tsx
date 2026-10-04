import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, ClipboardList, MessageCircle, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, apiRequest } from '../services/api'
import type { ClinicalIntake, Prediction } from '../types'

export default function HistoryPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [intakes, setIntakes] = useState<ClinicalIntake[]>([])
  const [disease, setDisease] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiRequest<{ predictions: Prediction[] }>('/api/predictions'),
      apiRequest<{ intakes: ClinicalIntake[] }>('/api/intakes'),
    ])
      .then(([predictionResult, intakeResult]) => {
        setPredictions(predictionResult.predictions)
        setIntakes(intakeResult.intakes)
      })
      .catch(cause => setError(cause instanceof ApiError ? cause.message : 'Unable to load prediction history.'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => predictions.filter(prediction => {
    const time = new Date(prediction.createdAt).getTime()
    return (disease === 'all' || prediction.disease === disease)
      && (!from || time >= new Date(`${from}T00:00:00`).getTime())
      && (!to || time < new Date(`${to}T00:00:00`).getTime() + 86_400_000)
  }), [predictions, disease, from, to])
  const visibleIntakes = useMemo(() => intakes.filter(intake => {
    const time = new Date(intake.createdAt).getTime()
    return (disease === 'all' || intake.disease === disease)
      && (!from || time >= new Date(`${from}T00:00:00`).getTime())
      && (!to || time < new Date(`${to}T00:00:00`).getTime() + 86_400_000)
  }), [intakes, disease, from, to])

  return (
    <div className="feature-page">
      <div className="eyebrow"><span /> YOUR SAVED ASSESSMENTS</div>
      <h1>Health<br /><em>history.</em></h1>
      <p className="feature-lede">Your submitted inputs, experimental synthetic-data scores, and earlier research-model estimates are saved to your account. Synthetic scores are not real-world disease probabilities.</p>
      <div className="history-filters">
        <label>Assessment<select value={disease} onChange={event => setDisease(event.target.value)}><option value="all">All assessments</option><option value="heart">Heart disease</option><option value="lung">Lung cancer</option><option value="diabetes">Diabetes</option></select></label>
        <label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
      </div>
      {loading && <div className="loading-panel"><span className="spinner" /> Loading your history…</div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!loading && !error && visible.length === 0 && visibleIntakes.length === 0 && (
        <section className="empty-history"><span><ClipboardList size={24} /></span><h2>No assessments found</h2><p>Start a clinical intake to save your submitted information in your private history.</p><Link to="/new-prediction" className="button button-primary">New clinical intake <ArrowRight size={16} /></Link></section>
      )}
      {visible.length > 0 && <><h2 className="history-section-title">Previous model estimates</h2><div className="history-list">
        {visible.map(prediction => (
          <article className="history-card" key={prediction.id}>
            <div className={`history-mark ${prediction.disease}`}><ClipboardList size={20} /></div>
            <div className="history-main">
              <div className="history-card-heading"><h2>{diseaseName(prediction.disease)}</h2><span>{prediction.riskPercentage.toFixed(1)}% model estimate</span></div>
              <div className="history-meta"><span><CalendarDays size={14} /> {new Date(prediction.createdAt).toLocaleString()}</span><span>{Object.keys(prediction.inputData).length} saved inputs</span><span>{prediction.fileCount ?? 0} reports</span></div>
              <p className="model-version">Model: {prediction.modelVersion} · Research-only; not a clinical diagnosis.</p>
            </div>
            <div className="history-actions">
              <Link to={`/history/${prediction.id}`}>View details <ArrowRight size={14} /></Link>
              {prediction.chatSessionId && <Link to={`/chat/${prediction.chatSessionId}`}><MessageCircle size={15} /> Continue chat</Link>}
            </div>
          </article>
        ))}
      </div></>}
      {visibleIntakes.length > 0 && <><h2 className="history-section-title">Clinical assessments <span>Estimates not calculated</span></h2><div className="history-list">
        {visibleIntakes.map(intake => (
          <article className="history-card" key={intake.id}>
            <div className={`history-mark ${intake.disease}`}><ClipboardList size={20} /></div>
            <div className="history-main">
              <div className="history-card-heading"><h2>{diseaseName(intake.disease)}</h2><span className="intake-no-risk">{intake.riskPercentage === null ? 'Not calculated' : `${intake.riskPercentage.toFixed(1)}% · ${intake.riskLevel} synthetic score band`}</span></div>
              <div className="history-meta"><span><CalendarDays size={14} /> {new Date(intake.createdAt).toLocaleString()}</span><span>{Object.keys(intake.inputData).length} saved inputs</span><span>{intake.fileCount} reports</span></div>
              <p className="model-version">{Object.entries(intake.derivedData).map(([key, value]) => `${key === 'bmi' ? 'BMI' : 'Pack-years'} ${value}`).join(' · ') || 'No derived measurements'}{intake.modelVersion ? ` · ${intake.modelVersion}` : ' · Synthetic model unavailable'}</p>
            </div>
            <div className="history-actions">
              <Link to={`/history/intake/${intake.id}`}>View assessment <ArrowRight size={14} /></Link>
              {intake.chatSessionId && <Link to={`/chat/${intake.chatSessionId}`}><MessageCircle size={15} /> Continue chat</Link>}
            </div>
          </article>
        ))}
      </div></>}
      <aside className="clinical-note"><ShieldAlert size={18} /><p>New synthetic-data scores estimate labels from generated data, not real-world disease probabilities; their Low/Medium/High bands are app-defined and not clinical cutoffs. Older estimates are research-only. Consult a qualified healthcare professional about health concerns.</p></aside>
    </div>
  )
}

export function diseaseName(disease: string | null) {
  if (disease === 'heart') return 'Heart disease'
  if (disease === 'diabetes') return 'Diabetes symptoms'
  if (disease === 'lung') return 'Lung cancer'
  return 'Health assessment'
}
