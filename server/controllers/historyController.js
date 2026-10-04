import { z } from 'zod'
import { pool } from '../database/pool.js'

export async function listPredictions(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.disease, p.input_data, p.risk_percentage, p.model_version, p.created_at,
              cs.id AS chat_session_id,
              (SELECT COUNT(*)::int FROM medical_files mf WHERE mf.prediction_id = p.id AND mf.user_id = p.user_id) AS file_count
       FROM predictions p
       LEFT JOIN chat_sessions cs ON cs.prediction_id = p.id AND cs.user_id = p.user_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id],
    )
    res.json({ predictions: result.rows.map(row => ({
      id: row.id,
      disease: row.disease,
      inputData: row.input_data,
      riskPercentage: Number(row.risk_percentage),
      modelVersion: row.model_version,
      createdAt: row.created_at,
      chatSessionId: row.chat_session_id,
      fileCount: row.file_count,
    })) })
  } catch (error) {
    next(error)
  }
}

export async function getPrediction(req, res, next) {
  const parsedId = z.string().uuid().safeParse(req.params.id)
  if (!parsedId.success) {
    res.status(400).json({ error: 'Invalid prediction ID.' })
    return
  }
  try {
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.disease, p.input_data, p.risk_percentage, p.risk_level,
              p.model_version, p.created_at, cs.id AS chat_session_id
       FROM predictions p
       LEFT JOIN chat_sessions cs ON cs.prediction_id = p.id AND cs.user_id = p.user_id
       WHERE p.id = $1 AND p.user_id = $2`,
      [parsedId.data, req.user.id],
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'Prediction not found.' })
      return
    }
    const row = result.rows[0]
    const files = await pool.query(
      `SELECT id, original_filename, file_type, file_size, analysis, created_at
       FROM medical_files WHERE prediction_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
      [row.id, req.user.id],
    )
    res.json({
      prediction: {
        id: row.id,
        disease: row.disease,
        inputData: row.input_data,
        riskPercentage: Number(row.risk_percentage),
        modelVersion: row.model_version,
        createdAt: row.created_at,
        chatSessionId: row.chat_session_id,
      },
      files: files.rows,
    })
  } catch (error) {
    next(error)
  }
}
