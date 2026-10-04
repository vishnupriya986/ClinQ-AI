import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, FileText, MessageCircle, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiRequest } from '../services/api'
import type { ChatMessage, MedicalFile, Prediction } from '../types'
import { diseaseName } from './HistoryPage'

export default function PredictionDetailsPage() {
  const { id } = useParams()
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [files, setFiles] = useState<MedicalFile[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiRequest<{ prediction: Prediction; files: MedicalFile[] }>(`/api/predictions/${id}`)
      .then(async result => {
        setPrediction(result.prediction)
        setFiles(result.files)
        if (result.prediction.chatSessionId) {
          const conversation = await apiRequest<{ messages: ChatMessage[] }>(`/api/chat/sessions/${result.prediction.chatSessionId}`)
          setMessages(conversation.messages)
        }
      })
      .catch(cause => setError(cause instanceof ApiError ? cause.message : 'Unable to load prediction details.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading-panel"><span className="spinner" /> Loading prediction…</div>
  if (error) return <div className="feature-page"><div className="error-banner" role="alert">{error}</div><Link className="back-link" to="/history"><ArrowLeft size={16} /> Prediction history</Link></div>
  if (!prediction) return null

  return (
    <div className="feature-page">
      <Link to="/history" className="back-link"><ArrowLeft size={16} /> Prediction history</Link>
      <div className="eyebrow"><span /> SAVED PREDICTION · {new Date(prediction.createdAt).toLocaleString()}</div>
      <h1>{diseaseName(prediction.disease)}<br /><em>details.</em></h1>
      <section className="result-card">
        <div className="result-label">AI-ESTIMATED DATASET MODEL SCORE</div>
        <strong>{prediction.riskPercentage.toFixed(1)}<small>%</small></strong>
        <p>Research model estimate from {prediction.modelVersion}. This is not a validated clinical risk or diagnosis.</p>
        {prediction.chatSessionId && <Link className="button button-primary" to={`/chat/${prediction.chatSessionId}`}>Continue this prediction’s chat <MessageCircle size={16} /></Link>}
      </section>
      <section className="details-section"><h2>Inputs submitted</h2><div className="input-summary-grid">{Object.entries(prediction.inputData).map(([key, value]) => <div key={key}><span>{friendlyLabel(key)}</span><b>{String(value)}</b></div>)}</div></section>
      <section className="details-section"><h2><FileText size={18} /> Associated reports</h2>{files.length ? <div className="report-list">{files.map(file => <div key={file.id}><a href={`/api/files/${file.id}`}>{file.original_filename}</a><span>{file.file_type} · {new Date(file.created_at).toLocaleDateString()}</span></div>)}</div> : <p className="muted-copy">No reports are attached to this prediction.</p>}</section>
      <section className="details-section"><h2><MessageCircle size={18} /> Complete chat history</h2>
        {messages.length ? <div className="intake-chat-history">{messages.map(message => <article className={`chat-message ${message.sender}`} key={message.id}>
          <div className="message-body"><div className="message-meta">{message.sender === 'assistant' ? 'ClinQ AI' : 'You'} · {new Date(message.created_at).toLocaleString()}</div><p>{message.message}</p>
            {message.attachment_id && <a className="attachment-link" href={`/api/files/${message.attachment_id}`}><FileText size={14} /> {message.attachment_name ?? 'Attached report'}</a>}
          </div>
        </article>)}</div> : <p className="muted-copy">No messages in this prediction chat yet.</p>}
        {prediction.chatSessionId && <Link className="button button-primary intake-chat-link" to={`/chat/${prediction.chatSessionId}`}>Continue Chat <MessageCircle size={15} /></Link>}
      </section>
      <section className="details-section"><h2><CalendarDays size={18} /> Model record</h2><p className="muted-copy">The prediction and its inputs are retained as originally submitted; later retraining will not alter this record. The model has not been clinically validated.</p></section>
      <aside className="clinical-note"><ShieldAlert size={18} /><p>This application provides educational health information only and does not replace professional medical advice, diagnosis, or treatment.</p></aside>
    </div>
  )
}

function friendlyLabel(key: string) {
  const labels: Record<string, string> = {
    trestbps: 'Resting blood pressure (mm Hg)',
    chol: 'Serum cholesterol (mg/dL)',
    fbs: 'Fasting blood sugar >120 mg/dL',
    restecg: 'Resting ECG code',
    thalach: 'Maximum heart rate',
    exang: 'Exercise-induced angina code',
    oldpeak: 'ST depression',
    slope: 'Peak ST slope code',
    ca: 'Major vessels on fluoroscopy',
    thal: 'Thal code',
    cp: 'Chest pain code',
    sex: 'Sex code (UCI)',
  }
  return labels[key] ?? key
}
