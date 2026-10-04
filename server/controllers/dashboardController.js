import { pool } from '../database/pool.js'

export async function dashboardSummary(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM predictions WHERE user_id = $1) AS predictions,
         (SELECT COUNT(*)::int FROM clinical_intakes WHERE user_id = $1) AS intakes,
         (SELECT COUNT(*)::int FROM chat_sessions WHERE user_id = $1) AS conversations,
         (SELECT COUNT(*)::int FROM medical_files WHERE user_id = $1) AS "medicalFiles"
       FROM users
       WHERE id = $1`,
      [req.user.id],
    )
    if (!result.rowCount) {
      res.status(401).json({ error: 'Your account could not be found. Please sign in again.' })
      return
    }
    res.json({ counts: result.rows[0] })
  } catch (error) {
    next(error)
  }
}
