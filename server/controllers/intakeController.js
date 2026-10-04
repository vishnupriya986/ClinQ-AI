import { z } from 'zod'
import { pool } from '../database/pool.js'
import { requestSyntheticEstimate } from '../services/modelClient.js'
import { classifySyntheticScore } from '../utils/syntheticScoreBand.js'

const sex = z.enum(['Male', 'Female', 'Other'])
const yesNo = z.enum(['Yes', 'No'])
const smoking = z.enum(['Never', 'Former', 'Current'])
const alcohol = z.enum(['Never', 'Occasionally', 'Frequently'])
const positiveMeasure = (maximum, label) => z.number().min(0, `${label} cannot be negative.`).max(maximum, `${label} is outside the supported input range.`)

const heartSchema = z.object({
  age: z.number().int().min(1).max(120),
  gender: sex,
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(10).max(500),
  systolicBloodPressure: positiveMeasure(350, 'Systolic blood pressure').min(1),
  diastolicBloodPressure: positiveMeasure(250, 'Diastolic blood pressure').min(1),
  totalCholesterol: positiveMeasure(1500, 'Total cholesterol').min(1),
  ldlCholesterol: positiveMeasure(1000, 'LDL cholesterol').min(1),
  hdlCholesterol: positiveMeasure(500, 'HDL cholesterol').min(1),
  triglycerides: positiveMeasure(10000, 'Triglycerides').min(1),
  bloodGlucose: positiveMeasure(2000, 'Blood glucose').min(1),
  diabetes: yesNo,
  smokingHabit: smoking,
  alcoholHabit: alcohol,
  weeklyExerciseMinutes: z.number().int().min(0).max(10080),
  familyHistoryOfHeartDisease: yesNo,
  previousHeartDisease: yesNo,
}).strict().superRefine((data, context) => {
  if (data.diastolicBloodPressure > data.systolicBloodPressure) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Diastolic blood pressure cannot exceed systolic blood pressure.',
      path: ['diastolicBloodPressure'],
    })
  }
})

const lungSchema = z.object({
  age: z.number().int().min(1).max(120),
  gender: sex,
  smokingStatus: smoking,
  cigarettesPerDay: z.number().int().min(0).max(200),
  yearsOfSmoking: z.number().min(0).max(100),
  secondhandSmokeExposure: yesNo,
  workplaceExposure: z.enum(['None', 'Low', 'High']),
  asbestosExposure: yesNo,
  radonExposure: z.enum(['Yes', 'No', 'Unknown']),
  airPollutionExposure: z.enum(['Low', 'Medium', 'High']),
  chronicLungDisease: yesNo,
  familyHistoryOfLungCancer: yesNo,
  previousCancerHistory: yesNo,
  previousChestRadiation: yesNo,
  persistentCough: yesNo,
  shortnessOfBreath: yesNo,
  chestPain: yesNo,
}).strict().superRefine((data, context) => {
  if (data.smokingStatus === 'Never' && (data.cigarettesPerDay > 0 || data.yearsOfSmoking > 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'For Never smoking status, cigarettes per day and years of smoking must both be 0.',
      path: ['smokingStatus'],
    })
  }
})

const diabetesSchema = z.object({
  age: z.number().int().min(1).max(120),
  gender: sex,
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(10).max(500),
  fastingBloodGlucose: positiveMeasure(2000, 'Fasting blood glucose').min(1),
  hba1c: z.number().min(0.1).max(30),
  systolicBloodPressure: positiveMeasure(350, 'Systolic blood pressure').min(1),
  diastolicBloodPressure: positiveMeasure(250, 'Diastolic blood pressure').min(1),
  familyHistoryOfDiabetes: yesNo,
  previousPrediabetes: yesNo,
  weeklyExerciseMinutes: z.number().int().min(0).max(10080),
  smokingHabit: smoking,
  alcoholHabit: alcohol,
  dietQuality: z.enum(['Healthy', 'Average', 'Unhealthy']),
  sugaryDrinksConsumption: z.enum(['Never', 'Occasionally', 'Frequently']),
  gestationalDiabetesHistory: z.enum(['Yes', 'No', 'N/A']),
  pcos: z.enum(['Yes', 'No', 'N/A']),
}).strict().superRefine((data, context) => {
  if (data.diastolicBloodPressure > data.systolicBloodPressure) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Diastolic blood pressure cannot exceed systolic blood pressure.',
      path: ['diastolicBloodPressure'],
    })
  }
})

const schemas = { heart: heartSchema, lung: lungSchema, diabetes: diabetesSchema }

export async function createClinicalIntake(req, res, next) {
  const { disease } = req.params
  const schema = schemas[disease]
  if (!schema) {
    res.status(404).json({ error: 'This clinical intake type is not supported.' })
    return
  }
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the submitted clinical inputs.' })
    return
  }
  try {
    const derived = deriveInputs(disease, parsed.data)
    const modelResult = await requestSyntheticEstimate(disease, parsed.data, derived)
    const riskPercentage = Number((modelResult.estimate * 100).toFixed(2))
    const riskLevel = classifySyntheticScore(riskPercentage)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO clinical_intakes
           (user_id, disease, input_data, derived_data, risk_percentage, risk_level, model_version, model_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'synthetic_model_estimate')
         RETURNING id, disease, input_data, derived_data, risk_percentage, risk_level,
                   model_version, model_status, created_at`,
        [req.user.id, disease, parsed.data, derived, riskPercentage, riskLevel, modelResult.modelVersion],
      )
      const intake = result.rows[0]
      const session = await client.query(
        `INSERT INTO chat_sessions (user_id, clinical_intake_id, title)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [req.user.id, intake.id, `${diseaseLabel(disease)} clinical intake`],
      )
      await client.query('COMMIT')
      res.status(201).json({ intake: toPublicIntake(intake, session.rows[0].id) })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    next(error)
  }
}

export async function listClinicalIntakes(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT ci.id, ci.disease, ci.input_data, ci.derived_data, ci.risk_percentage,
              ci.risk_level, ci.model_version, ci.model_status, ci.created_at,
              cs.id AS chat_session_id,
              (SELECT COUNT(*)::int FROM medical_files mf
               WHERE mf.clinical_intake_id = ci.id AND mf.user_id = ci.user_id) AS file_count
       FROM clinical_intakes ci
       LEFT JOIN chat_sessions cs ON cs.clinical_intake_id = ci.id AND cs.user_id = ci.user_id
       WHERE ci.user_id = $1 ORDER BY ci.created_at DESC`,
      [req.user.id],
    )
    res.json({ intakes: result.rows.map(row => toPublicIntake(row, row.chat_session_id, row.file_count)) })
  } catch (error) {
    next(error)
  }
}

export async function getClinicalIntake(req, res, next) {
  const parsedId = z.string().uuid().safeParse(req.params.id)
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid clinical intake ID.' })
    return
  }
  try {
    const result = await pool.query(
      `SELECT ci.id, ci.disease, ci.input_data, ci.derived_data, ci.risk_percentage,
              ci.risk_level, ci.model_version, ci.model_status, ci.created_at,
              cs.id AS chat_session_id,
              (SELECT COUNT(*)::int FROM medical_files mf
               WHERE mf.clinical_intake_id = ci.id AND mf.user_id = ci.user_id) AS file_count
       FROM clinical_intakes ci
       LEFT JOIN chat_sessions cs ON cs.clinical_intake_id = ci.id AND cs.user_id = ci.user_id
       WHERE ci.id = $1 AND ci.user_id = $2`,
      [parsedId.data, req.user.id],
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'Clinical intake not found.' })
      return
    }
    const intake = result.rows[0]
    const files = await pool.query(
      `SELECT id, original_filename, file_type, file_size, analysis, created_at
       FROM medical_files WHERE clinical_intake_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [parsedId.data, req.user.id],
    )
    res.json({
      intake: toPublicIntake(intake, intake.chat_session_id, intake.file_count),
      files: files.rows,
    })
  } catch (error) {
    next(error)
  }
}

function deriveInputs(disease, input) {
  const result = {}
  if (disease === 'heart' || disease === 'diabetes') {
    result.bmi = Number((input.weightKg / ((input.heightCm / 100) ** 2)).toFixed(1))
  }
  if (disease === 'lung') {
    result.packYears = Number(((input.cigarettesPerDay * input.yearsOfSmoking) / 20).toFixed(2))
  }
  return result
}

function toPublicIntake(row, chatSessionId = null, fileCount = 0) {
  return {
    id: row.id,
    disease: row.disease,
    inputData: row.input_data,
    derivedData: row.derived_data,
    riskPercentage: row.risk_percentage === null ? null : Number(row.risk_percentage),
    riskLevel: row.risk_level,
    modelVersion: row.model_version,
    modelStatus: row.model_status,
    createdAt: row.created_at,
    chatSessionId,
    fileCount,
  }
}

function diseaseLabel(disease) {
  return disease === 'heart' ? 'Heart disease' : disease === 'lung' ? 'Lung cancer' : 'Diabetes'
}
