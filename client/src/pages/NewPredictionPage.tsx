import { ArrowLeft, ArrowRight, HeartPulse, ShieldAlert, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NewPredictionPage() {
  return (
    <div className="feature-page">
      <Link to="/dashboard" className="back-link"><ArrowLeft size={16} /> Dashboard</Link>
      <div className="eyebrow"><span /> SELECT AN ASSESSMENT</div>
      <h1>What would you like<br /><em>to explore?</em></h1>
      <p className="feature-lede">Choose a clinical intake. Your submitted information is saved to your private history; compatible, validated risk models are not yet available for these fields.</p>
      <div className="disease-grid">
        <Link to="/prediction/heart" className="disease-card">
          <span className="disease-icon heart"><HeartPulse size={25} /></span>
          <span className="dataset-tag">17 CLINICAL INPUTS</span>
          <h2>Heart disease</h2>
          <p>Cardiovascular history, blood pressure, lipid panel, glucose, weight, smoking and activity.</p>
          <span className="disease-action">Start clinical intake <ArrowRight size={16} /></span>
        </Link>
        <Link to="/prediction/diabetes" className="disease-card">
          <span className="disease-icon diabetes"><Stethoscope size={24} /></span>
          <span className="dataset-tag">17 CLINICAL INPUTS</span>
          <h2>Diabetes</h2>
          <p>Glucose, HbA1c, BMI, blood pressure, family history, activity and relevant health history.</p>
          <span className="disease-action">Start clinical intake <ArrowRight size={16} /></span>
        </Link>
        <Link to="/prediction/lung" className="disease-card">
          <span className="disease-icon lung"><ShieldAlert size={24} /></span>
          <span className="dataset-tag">17 CLINICAL INPUTS</span>
          <h2>Lung cancer</h2>
          <p>Smoking and pack-year history, environmental exposures, symptoms and family history.</p>
          <span className="disease-action">Start clinical intake <ArrowRight size={16} /></span>
        </Link>
      </div>
      <aside className="clinical-note"><ShieldAlert size={18} /><p>These are saved clinical history inputs only. No disease probability or diagnosis is generated from them. For health concerns, consult a qualified healthcare professional.</p></aside>
    </div>
  )
}
