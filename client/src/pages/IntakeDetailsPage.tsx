import { useEffect, useState } from 'react'
import { ArrowLeft, ClipboardCheck, FileText, MessageCircle, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiRequest } from '../services/api'
import type { ChatMessage, ClinicalIntake } from '../types'
import { summarizeIntake } from '../utils/intakeSummary'
import { diseaseName } from './HistoryPage'

const labels: Record<string, string> = {
  age: 'Age',
  gender: 'Gender',
  heightCm: 'Height (cm)',
  weightKg: 'Weight (kg)',
  systolicBloodPressure: 'Systolic blood pressure (mmHg)',
  diastolicBloodPressure: 'Diastolic blood pressure (mmHg)',
  totalCholesterol: 'Total cholesterol (mg/dL)',
  ldlCholesterol: 'LDL cholesterol (mg/dL)',
  hdlCholesterol: 'HDL cholesterol (mg/dL)',
  triglycerides: 'Triglycerides (mg/dL)',
  bloodGlucose: 'Blood glucose (mg/dL)',
  diabetes: 'Diabetes',
  smokingHabit: 'Smoking habit',
  alcoholHabit: 'Alcohol habit',
  weeklyExerciseMinutes: 'Weekly exercise (minutes)',
  familyHistoryOfHeartDisease: 'Family history of heart disease',
  previousHeartDisease: 'Previous heart disease',
  smokingStatus: 'Smoking status',
  cigarettesPerDay: 'Cigarettes per day',
  yearsOfSmoking: 'Years of smoking',
  secondhandSmokeExposure: 'Secondhand smoke exposure',
  workplaceExposure: 'Workplace exposure',
  asbestosExposure: 'Asbestos exposure',
  radonExposure: 'Radon exposure',
  airPollutionExposure: 'Air pollution exposure',
  chronicLungDisease: 'Chronic lung disease',
  familyHistoryOfLungCancer: 'Family history of lung cancer',
  previousCancerHistory: 'Previous cancer history',
  previousChestRadiation: 'Previous chest radiation',
  persistentCough: 'Persistent cough',
  shortnessOfBreath: 'Shortness of breath',
  chestPain: 'Chest pain',
  fastingBloodGlucose: 'Fasting blood glucose (mg/dL)',
  hba1c: 'HbA1c (%)',
  familyHistoryOfDiabetes: 'Family history of diabetes',
  previousPrediabetes: 'Previous prediabetes',
  dietQuality: 'Diet quality',
  sugaryDrinksConsumption: 'Sugary drinks consumption',
  gestationalDiabetesHistory: 'Gestational diabetes history',
  pcos: 'PCOS',
}

export default function IntakeDetailsPage() {
  const { id } = useParams()
  const [intake, setIntake] = useState<ClinicalIntake | null>(null)
  const [files, setFiles] = useState<{ id: string; original_filename: string; file_type: string; created_at: string; analysis: { text: string; analyzedAt: string } | null }[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    apiRequest<{ intake: ClinicalIntake; files: typeof files }>(`/api/intakes/${id}`)
      .then(async result => {
        setIntake(result.intake)
        setFiles(result.files)
        if (result.intake.chatSessionId) {
          const conversation = await apiRequest<{ messages: ChatMessage[] }>(`/api/chat/sessions/${result.intake.chatSessionId}`)
          setMessages(conversation.messages)
        }
      })
      .catch(cause => setError(cause instanceof ApiError ? cause.message : 'Unable to load this clinical intake.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="loading-panel"><span className="spinner" /> Loading clinical intake…</div>
  if (error) return <div className="feature-page"><div className="error-banner" role="alert">{error}</div><Link to="/history" className="back-link"><ArrowLeft size={16} /> History</Link></div>
  if (!intake) return null
  return (
    <div className="feature-page">
      <Link to="/history" className="back-link"><ArrowLeft size={16} /> History</Link>
      <div className="eyebrow"><span /> SAVED CLINICAL INTAKE · {new Date(intake.createdAt).toLocaleString()}</div>
      <h1>{diseaseName(intake.disease)}<br /><em>assessment.</em></h1>
      <section className="intake-status-card">
        <ClipboardCheck size={20} />
        <div>
          {intake.riskPercentage === null
            ? <><strong>Risk percentage: Not calculated</strong><p>Risk category: Not assigned. A compatible model result is unavailable.</p></>
            : <><strong>Synthetic-data model score: {intake.riskPercentage.toFixed(1)}%</strong><p>Synthetic score band: {intake.riskLevel}. Model: {intake.modelVersion}.</p></>}
          {intake.chatSessionId && <Link className="button button-primary intake-chat-link" to={`/chat/${intake.chatSessionId}`}>Continue this assessment’s chat <MessageCircle size={15} /></Link>}
        </div>
      </section>
      <section className="intake-recap"><h2>Summary of the information entered</h2><p>{summarizeIntake(intake.disease, intake.inputData, intake.derivedData)}</p><small>This is a factual recap of your entries, not an assessment of disease risk.</small></section>
      <section className="details-section"><h2>Submitted clinical inputs</h2><div className="input-summary-grid">{Object.entries(intake.inputData).map(([key, value]) => <div key={key}><span>{labels[key] ?? key}</span><b>{String(value)}</b></div>)}</div></section>
      {Object.keys(intake.derivedData).length > 0 && <section className="details-section"><h2>Automatically calculated measurements</h2><div className="input-summary-grid">{Object.entries(intake.derivedData).map(([key, value]) => <div key={key}><span>{key === 'bmi' ? 'BMI (kg/m²)' : 'Smoking pack-years'}</span><b>{value}</b></div>)}</div></section>}
      <section className="details-section"><h2><FileText size={18} /> Associated reports</h2>{files.length ? <div className="report-list">{files.map(file => <div key={file.id}><a href={`/api/files/${file.id}`}>{file.original_filename}</a><span>{file.file_type} · {file.analysis ? 'Analyzed' : 'Analysis unavailable'} · {new Date(file.created_at).toLocaleDateString()}</span></div>)}</div> : <p className="muted-copy">No reports are attached to this assessment.</p>}</section>
      <section className="details-section"><h2><MessageCircle size={18} /> Complete chat history</h2>
        {messages.length ? <div className="intake-chat-history">{messages.map(message => <article className={`chat-message ${message.sender}`} key={message.id}>
          <div className="message-body"><div className="message-meta">{message.sender === 'assistant' ? 'ClinQ AI' : 'You'} · {new Date(message.created_at).toLocaleString()}</div><p>{message.message}</p>
            {message.attachment_id && <a className="attachment-link" href={`/api/files/${message.attachment_id}`}><FileText size={14} /> {message.attachment_name ?? 'Attached report'}</a>}
          </div>
        </article>)}</div> : <p className="muted-copy">No messages in this assessment chat yet.</p>}
        {intake.chatSessionId && <Link className="button button-primary intake-chat-link" to={`/chat/${intake.chatSessionId}`}>Continue Chat <MessageCircle size={15} /></Link>}
      </section>
      <aside className="clinical-note"><ShieldAlert size={18} /><p>{intake.riskPercentage === null ? 'No model estimate is stored for this intake.' : 'This experimental score estimates a label in a synthetic dataset only. The percentage is not a real-world disease probability; score bands are app-defined and not clinical cutoffs.'} This information is not a diagnosis. For clinical interpretation or care decisions, consult a qualified healthcare professional.</p></aside>
    </div>
  )
}
