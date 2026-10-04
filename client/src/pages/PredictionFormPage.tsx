import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ClipboardCheck, HeartPulse, LoaderCircle, ShieldAlert, Stethoscope } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError, apiRequest } from '../services/api'

type Option = { value: string; label: string }
type Field = {
  name: string
  label: string
  type: 'number' | 'select'
  options?: Option[]
  min?: number
  max?: number
  step?: number
  unit?: string
}

const options = (values: string[]) => values.map(value => ({ value, label: value }))
const sexOptions = options(['Male', 'Female', 'Other'])
const yesNo = options(['Yes', 'No'])
const smokingOptions = options(['Never', 'Former', 'Current'])
const alcoholOptions = options(['Never', 'Occasionally', 'Frequently'])
const numberField = (name: string, label: string, unit: string, min: number, max: number, step = 1): Field => ({ name, label, unit, min, max, step, type: 'number' })
const choice = (name: string, label: string, fieldOptions: Option[]): Field => ({ name, label, type: 'select', options: fieldOptions })

const fieldDefinitions: Record<string, Field[]> = {
  heart: [
    numberField('age', 'Age', 'years', 1, 120),
    choice('gender', 'Gender', sexOptions),
    numberField('heightCm', 'Height', 'cm', 50, 260, 0.1),
    numberField('weightKg', 'Weight', 'kg', 10, 500, 0.1),
    numberField('systolicBloodPressure', 'Systolic blood pressure', 'mmHg', 1, 350),
    numberField('diastolicBloodPressure', 'Diastolic blood pressure', 'mmHg', 1, 250),
    numberField('totalCholesterol', 'Total cholesterol', 'mg/dL', 1, 1500),
    numberField('ldlCholesterol', 'LDL cholesterol', 'mg/dL', 1, 1000),
    numberField('hdlCholesterol', 'HDL cholesterol', 'mg/dL', 1, 500),
    numberField('triglycerides', 'Triglycerides', 'mg/dL', 1, 10000),
    numberField('bloodGlucose', 'Blood glucose', 'mg/dL', 1, 2000),
    choice('diabetes', 'Diabetes', yesNo),
    choice('smokingHabit', 'Smoking habit', smokingOptions),
    choice('alcoholHabit', 'Alcohol habit', alcoholOptions),
    numberField('weeklyExerciseMinutes', 'Weekly exercise', 'minutes/week', 0, 10080),
    choice('familyHistoryOfHeartDisease', 'Family history of heart disease', yesNo),
    choice('previousHeartDisease', 'Previous heart disease', yesNo),
  ],
  lung: [
    numberField('age', 'Age', 'years', 1, 120),
    choice('gender', 'Gender', sexOptions),
    choice('smokingStatus', 'Smoking status', smokingOptions),
    numberField('cigarettesPerDay', 'Cigarettes per day', 'cigarettes/day', 0, 200),
    numberField('yearsOfSmoking', 'Years of smoking', 'years', 0, 100, 0.5),
    choice('secondhandSmokeExposure', 'Secondhand smoke exposure', yesNo),
    choice('workplaceExposure', 'Workplace exposure', options(['None', 'Low', 'High'])),
    choice('asbestosExposure', 'Asbestos exposure', yesNo),
    choice('radonExposure', 'Radon exposure', options(['Yes', 'No', 'Unknown'])),
    choice('airPollutionExposure', 'Air pollution exposure', options(['Low', 'Medium', 'High'])),
    choice('chronicLungDisease', 'Chronic lung disease', yesNo),
    choice('familyHistoryOfLungCancer', 'Family history of lung cancer', yesNo),
    choice('previousCancerHistory', 'Previous cancer history', yesNo),
    choice('previousChestRadiation', 'Previous chest radiation', yesNo),
    choice('persistentCough', 'Persistent cough', yesNo),
    choice('shortnessOfBreath', 'Shortness of breath', yesNo),
    choice('chestPain', 'Chest pain', yesNo),
  ],
  diabetes: [
    numberField('age', 'Age', 'years', 1, 120),
    choice('gender', 'Gender', sexOptions),
    numberField('heightCm', 'Height', 'cm', 50, 260, 0.1),
    numberField('weightKg', 'Weight', 'kg', 10, 500, 0.1),
    numberField('fastingBloodGlucose', 'Fasting blood glucose', 'mg/dL', 1, 2000),
    numberField('hba1c', 'HbA1c', '%', 0.1, 30, 0.1),
    numberField('systolicBloodPressure', 'Systolic blood pressure', 'mmHg', 1, 350),
    numberField('diastolicBloodPressure', 'Diastolic blood pressure', 'mmHg', 1, 250),
    choice('familyHistoryOfDiabetes', 'Family history of diabetes', yesNo),
    choice('previousPrediabetes', 'Previous prediabetes', yesNo),
    numberField('weeklyExerciseMinutes', 'Weekly exercise', 'minutes/week', 0, 10080),
    choice('smokingHabit', 'Smoking habit', smokingOptions),
    choice('alcoholHabit', 'Alcohol habit', alcoholOptions),
    choice('dietQuality', 'Diet quality', options(['Healthy', 'Average', 'Unhealthy'])),
    choice('sugaryDrinksConsumption', 'Sugary drinks consumption', alcoholOptions),
    choice('gestationalDiabetesHistory', 'Gestational diabetes history', options(['Yes', 'No', 'N/A'])),
    choice('pcos', 'PCOS', options(['Yes', 'No', 'N/A'])),
  ],
}

const diseaseLabels: Record<string, string> = {
  heart: 'Heart disease',
  lung: 'Lung cancer',
  diabetes: 'Diabetes',
}

export default function PredictionFormPage() {
  const { disease } = useParams()
  const navigate = useNavigate()
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fields = disease ? fieldDefinitions[disease] : undefined
  const isHeart = disease === 'heart'
  const isLung = disease === 'lung'
  const derived = useMemo(() => {
    const height = Number(values.heightCm)
    const weight = Number(values.weightKg)
    const bmi = height > 0 && weight > 0 ? (weight / ((height / 100) ** 2)).toFixed(1) : null
    const cigarettes = Number(values.cigarettesPerDay)
    const years = Number(values.yearsOfSmoking)
    const packYears = isLung && values.cigarettesPerDay !== undefined && values.yearsOfSmoking !== undefined
      ? ((cigarettes * years) / 20).toFixed(2)
      : null
    return { bmi, packYears }
  }, [values, isLung])

  if (!fields || !disease) return <Navigate to="/new-prediction" replace />

  const activeFields = fields
  const activeDisease = disease

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const numericFields = new Set(activeFields.filter(field => field.type === 'number').map(field => field.name))
    const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [
      key,
      numericFields.has(key) ? Number(value) : value,
    ]))
    setBusy(true)
    try {
      const result = await apiRequest<{ intake: { id: string; chatSessionId: string } }>(`/api/intakes/${activeDisease}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      navigate(`/chat/${result.intake.chatSessionId}`, { replace: true })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save these clinical inputs.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="feature-page">
      <Link to="/new-prediction" className="back-link"><ArrowLeft size={16} /> Choose another assessment</Link>
      <div className="form-heading">
        <span className={`disease-icon ${isHeart ? 'heart' : isLung ? 'lung' : 'diabetes'}`}>
          {isHeart ? <HeartPulse size={24} /> : <Stethoscope size={23} />}
        </span>
        <div><div className="eyebrow"><span /> CLINICAL INTAKE</div><h1>{diseaseLabels[disease]}</h1></div>
      </div>
      <p className="feature-lede">Enter values from your records where possible. We’ll run an experimental model trained on synthetic data and save the result to your private history. Its score is not a real-world disease probability.</p>
      <form onSubmit={submit} className="assessment-form">
        <div className="assessment-fields">
          {activeFields.map((field, index) => {
            const id = `clinical-${field.name}`
            return (
              <label className="assessment-field" htmlFor={id} key={field.name}>
                <span>{index + 1}. {field.label}<b> *</b></span>
                {field.type === 'select' ? (
                  <select
                    id={id}
                    required
                    value={values[field.name] ?? ''}
                    onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                  >
                    <option value="" disabled>Select one</option>
                    {field.options?.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <div className="number-input-wrap">
                    <input
                      id={id}
                      type="number"
                      required
                      min={field.min}
                      max={field.max}
                      step={field.step ?? 1}
                      value={values[field.name] ?? ''}
                      onChange={event => setValues(current => ({ ...current, [field.name]: event.target.value }))}
                    />
                    <span>{field.unit}</span>
                  </div>
                )}
              </label>
            )
          })}
          {!isLung && (
            <div className="derived-field" aria-live="polite">
              <span>Calculated BMI</span>
              <b>{derived.bmi ?? 'Enter height and weight'}</b>
              <small>Automatically derived; not a diagnosis.</small>
            </div>
          )}
          {isLung && (
            <div className="derived-field" aria-live="polite">
              <span>Calculated pack-years</span>
              <b>{derived.packYears === null ? 'Enter cigarettes per day and years smoked' : `${derived.packYears} pack-years`}</b>
              <small>(Cigarettes/day × years smoked) ÷ 20. This is a derived history measure, not a risk score.</small>
            </div>
          )}
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <aside className="clinical-note"><ShieldAlert size={18} /><p><b>Experimental synthetic-data score only.</b> The model estimates labels in a generated dataset; its percentage and Low/Medium/High band do not represent real-world personal disease risk and are not medically validated. Selecting “Predict Risk” saves the model output and opens this assessment’s private chat.</p></aside>
        <button className="button button-primary assessment-submit" disabled={busy}>
          {busy ? <><LoaderCircle className="spin-icon" size={17} /> Saving and opening chat…</> : <>Predict Risk <ClipboardCheck size={17} /></>}
        </button>
      </form>
    </div>
  )
}
