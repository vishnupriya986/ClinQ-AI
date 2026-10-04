import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, FileText, LoaderCircle, MessageCircle, Paperclip, Send, ShieldAlert, UploadCloud } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiRequest } from '../services/api'
import type { ChatMessage, ClinicalIntake, MedicalFile } from '../types'
import { summarizeIntake } from '../utils/intakeSummary'
import { diseaseName } from './HistoryPage'

interface SessionData {
  session: {
    id: string
    title: string
    prediction_id: string | null
    clinical_intake_id: string | null
    disease: ClinicalIntake['disease']
    input_data: Record<string, string | number> | null
    derived_data: Record<string, number> | null
    risk_percentage: string | number | null
    risk_level: 'Low' | 'Medium' | 'High' | null
    model_version: string | null
    prediction_created_at: string | null
    intake_created_at: string | null
  }
  messages: ChatMessage[]
  files: MedicalFile[]
}

export default function ChatPage() {
  const { sessionId } = useParams()
  const [data, setData] = useState<SessionData | null>(null)
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadSession() {
    setLoading(true)
    setError('')
    try {
      setData(await apiRequest<SessionData>(`/api/chat/sessions/${sessionId}`))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to load this conversation.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSession() }, [sessionId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [data?.messages.length])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = message.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      const response = await apiRequest<{ userMessage: ChatMessage; assistantMessage: ChatMessage }>(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      setData(current => current ? { ...current, messages: [...current.messages, response.userMessage, response.assistantMessage] } : current)
      setMessage('')
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : 'Unable to send your message.'
      await loadSession()
      setError(message)
    } finally {
      setSending(false)
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selected = fileRef.current?.files?.[0]
    if (!selected || uploading) return
    setUploading(true)
    setError('')
    const body = new FormData()
    body.append('file', selected)
    body.append('aiConsent', String(consent))
    try {
      const response = await apiRequest<{ file: MedicalFile; userMessage: ChatMessage; assistantMessage?: ChatMessage; analysisError?: string }>(`/api/chat/sessions/${sessionId}/files`, { method: 'POST', body })
      setData(current => current ? {
        ...current,
        files: [response.file, ...current.files],
        messages: [...current.messages, response.userMessage, ...(response.assistantMessage ? [response.assistantMessage] : [])],
      } : current)
      setError(response.analysisError ?? '')
      event.currentTarget.reset()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to analyze this file.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="loading-panel"><span className="spinner" /> Restoring prediction and conversation…</div>
  if (error && !data) return <div className="feature-page"><div className="error-banner" role="alert">{error}</div><Link to="/history" className="back-link"><ArrowLeft size={16} /> History</Link></div>
  if (!data) return null

  const hasRiskEstimate = data.session.risk_percentage !== null
  const recordedAt = data.session.prediction_created_at ?? data.session.intake_created_at
  return (
    <div className="chat-page">
      <div className="chat-top-links"><Link to="/history"><ArrowLeft size={15} /> History</Link><span><MessageCircle size={15} /> This chat belongs to one assessment</span></div>
      <section className="chat-prediction-card">
        <div><div className="eyebrow"><span /> {hasRiskEstimate ? (data.session.model_version?.includes('_synthetic_') ? 'SYNTHETIC-DATA MODEL SCORE' : 'RESEARCH-ONLY MODEL ESTIMATE') : 'CLINICAL INTAKE SAVED'}</div><h1>{diseaseName(data.session.disease)}</h1><p>{recordedAt ? new Date(recordedAt).toLocaleString() : ''}{hasRiskEstimate && data.session.model_version ? ` · ${data.session.model_version}` : ''}</p></div>
        <div className={`assessment-result-status ${hasRiskEstimate ? 'research-result' : ''}`}>
          <strong>{hasRiskEstimate ? <>{Number(data.session.risk_percentage).toFixed(1)}<small>%</small></> : 'Not calculated'}</strong>
          <span>{hasRiskEstimate ? `Synthetic score band: ${data.session.risk_level ?? 'Not assigned'}` : 'Risk category: Not assigned'}</span>
        </div>
      </section>
      <aside className="research-warning"><ShieldAlert size={16} /><p>{hasRiskEstimate && data.session.model_version?.includes('_synthetic_') ? 'This experimental score estimates a synthetic dataset label only. It is not a real-world disease probability, validated risk calculator, medical diagnosis, or treatment advice. Score bands are app-defined and not clinical cutoffs.' : hasRiskEstimate ? 'This public-dataset model is research-only and not clinically validated. This score is not a medical diagnosis or validated individual risk.' : 'No risk estimate was generated because a compatible model for these clinical inputs has not been trained and validated. Your inputs are saved and available in this private assessment chat.'} Discuss health concerns with a qualified healthcare professional.</p></aside>
      {data.session.input_data && <section className="details-section chat-inputs"><h2>Assessment inputs</h2><div className="input-summary-grid">{Object.entries(data.session.input_data).map(([key, value]) => <div key={key}><span>{inputLabel(key)}</span><b>{String(value)}</b></div>)}</div></section>}
      {data.session.derived_data && Object.keys(data.session.derived_data).length > 0 && <section className="details-section chat-inputs"><h2>Calculated measurements</h2><div className="input-summary-grid">{Object.entries(data.session.derived_data).map(([key, value]) => <div key={key}><span>{key === 'bmi' ? 'BMI (kg/m²)' : 'Smoking pack-years'}</span><b>{value}</b></div>)}</div></section>}
      {data.session.clinical_intake_id && data.session.input_data && <section className="intake-recap" aria-label="Entered information summary"><h2>Summary of the information entered</h2><p>{summarizeIntake(data.session.disease, data.session.input_data, data.session.derived_data ?? {})}</p><small>This is a factual recap of your entries, not a medical assessment.</small></section>}
      <section className="chat-window" aria-label="Assessment conversation">
        {data.messages.length === 0 && <div className="chat-empty"><span><MessageCircle size={22} /></span><h2>Ask about your health information</h2><p>This conversation belongs only to this assessment. Ask about the inputs above or upload a report to discuss its contents. The assistant cannot diagnose or prescribe.</p></div>}
        {data.messages.map(item => (
          <article className={`chat-message ${item.sender}`} key={item.id}>
            <span className="message-avatar">{item.sender === 'assistant' ? <MessageCircle size={16} /> : 'You'}</span>
            <div className="message-body"><div className="message-meta">{item.sender === 'assistant' ? 'ClinQ AI' : 'You'} · {new Date(item.created_at).toLocaleTimeString()}</div><p>{item.message}</p>{item.attachment_id && <a className="attachment-link" href={`/api/files/${item.attachment_id}`}><FileText size={14} /> {item.attachment_name ?? 'Attached report'}</a>}</div>
          </article>
        ))}
        {sending && <div className="typing-state"><span className="spinner" /> AI is analyzing your question…</div>}
        <div ref={bottomRef} />
      </section>
      {error && <div className="error-banner chat-error" role="alert">{error}</div>}
      <div className="chat-tools">
        <div className="attached-documents">
          <span><Paperclip size={14} /> This chat’s reports</span>
          {data.files.map(file => <a key={file.id} href={`/api/files/${file.id}`}><FileText size={13} /> {file.original_filename}{file.analysis ? '' : ' · analysis unavailable'}</a>)}
          {data.files.length === 0 && <small>No reports attached yet</small>}
        </div>
        <form className="upload-form" onSubmit={uploadDocument}>
          <label className="consent-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> I agree to send the selected document to the configured AI provider for analysis.</label>
          <div className="upload-controls"><input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={!consent || uploading} required aria-label="Choose medical report" /><button className="button button-secondary" type="submit" disabled={!consent || uploading}>{uploading ? <><LoaderCircle className="spin-icon" size={15} /> Analyzing…</> : <><UploadCloud size={16} /> Analyze report</>}</button></div>
        </form>
      </div>
      <form className="chat-composer" onSubmit={sendMessage}>
        <textarea value={message} maxLength={4000} onChange={event => setMessage(event.target.value)} placeholder="Ask about your health information or an uploaded report…" rows={2} aria-label="Message" />
        <button className="button button-primary send-button" disabled={!message.trim() || sending} aria-label="Send message">{sending ? <LoaderCircle className="spin-icon" size={17} /> : <Send size={17} />}</button>
      </form>
      <p className="chat-disclaimer">Do not use this chat for emergencies. Never start, stop, or change prescribed medication based on AI information. Chat responses and report analysis require AI provider configuration.</p>
    </div>
  )
}

function inputLabel(key: string) {
  const labels: Record<string, string> = {
    age: 'Age', gender: 'Gender', heightCm: 'Height (cm)', weightKg: 'Weight (kg)',
    systolicBloodPressure: 'Systolic blood pressure (mmHg)', diastolicBloodPressure: 'Diastolic blood pressure (mmHg)',
    totalCholesterol: 'Total cholesterol (mg/dL)', ldlCholesterol: 'LDL cholesterol (mg/dL)',
    hdlCholesterol: 'HDL cholesterol (mg/dL)', triglycerides: 'Triglycerides (mg/dL)',
    bloodGlucose: 'Blood glucose (mg/dL)', diabetes: 'Diabetes', smokingHabit: 'Smoking habit',
    alcoholHabit: 'Alcohol habit', weeklyExerciseMinutes: 'Weekly exercise (minutes)',
    familyHistoryOfHeartDisease: 'Family history of heart disease', previousHeartDisease: 'Previous heart disease',
    smokingStatus: 'Smoking status', cigarettesPerDay: 'Cigarettes per day', yearsOfSmoking: 'Years of smoking',
    secondhandSmokeExposure: 'Secondhand smoke exposure', workplaceExposure: 'Workplace exposure',
    asbestosExposure: 'Asbestos exposure', radonExposure: 'Radon exposure', airPollutionExposure: 'Air pollution exposure',
    chronicLungDisease: 'Chronic lung disease', familyHistoryOfLungCancer: 'Family history of lung cancer',
    previousCancerHistory: 'Previous cancer history', previousChestRadiation: 'Previous chest radiation',
    persistentCough: 'Persistent cough', shortnessOfBreath: 'Shortness of breath', chestPain: 'Chest pain',
    fastingBloodGlucose: 'Fasting blood glucose (mg/dL)', hba1c: 'HbA1c (%)',
    familyHistoryOfDiabetes: 'Family history of diabetes', previousPrediabetes: 'Previous prediabetes',
    dietQuality: 'Diet quality', sugaryDrinksConsumption: 'Sugary drinks consumption',
    gestationalDiabetesHistory: 'Gestational diabetes history', pcos: 'PCOS',
  }
  return labels[key] ?? key
}
