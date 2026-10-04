import { z } from 'zod'
import { pool } from '../database/pool.js'
import { requestAiText, urgentSafetyResponse } from '../services/aiService.js'

const messageSchema = z.object({ message: z.string().trim().min(1).max(4000) }).strict()

export async function listChatSessions(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT cs.id, cs.title, cs.prediction_id, cs.clinical_intake_id,
              cs.created_at, cs.updated_at,
              COALESCE(p.disease, ci.disease) AS disease,
              COALESCE(p.input_data, ci.input_data) AS input_data,
              COALESCE(p.risk_percentage, NULL) AS risk_percentage,
              p.model_version,
              (SELECT COUNT(*)::int FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count
       FROM chat_sessions cs
       LEFT JOIN predictions p ON p.id = cs.prediction_id AND p.user_id = cs.user_id
       LEFT JOIN clinical_intakes ci ON ci.id = cs.clinical_intake_id AND ci.user_id = cs.user_id
       WHERE cs.user_id = $1
       ORDER BY cs.updated_at DESC`,
      [req.user.id],
    )
    res.json({ sessions: result.rows })
  } catch (error) {
    next(error)
  }
}

export async function getChatSession(req, res, next) {
  const sessionId = z.string().uuid().safeParse(req.params.sessionId)
  if (!sessionId.success) {
    res.status(400).json({ error: 'Invalid conversation ID.' })
    return
  }
  try {
    const sessionResult = await pool.query(
      `SELECT cs.id, cs.title, cs.prediction_id, cs.clinical_intake_id,
              cs.created_at, cs.updated_at,
              COALESCE(p.disease, ci.disease) AS disease,
              COALESCE(p.input_data, ci.input_data) AS input_data,
              ci.derived_data, COALESCE(p.risk_percentage, ci.risk_percentage) AS risk_percentage,
              COALESCE(p.risk_level, ci.risk_level) AS risk_level,
              COALESCE(p.model_version, ci.model_version) AS model_version,
              p.created_at AS prediction_created_at, ci.created_at AS intake_created_at
       FROM chat_sessions cs
       LEFT JOIN predictions p ON p.id = cs.prediction_id AND p.user_id = cs.user_id
       LEFT JOIN clinical_intakes ci ON ci.id = cs.clinical_intake_id AND ci.user_id = cs.user_id
       WHERE cs.id = $1 AND cs.user_id = $2`,
      [sessionId.data, req.user.id],
    )
    if (!sessionResult.rowCount) {
      res.status(404).json({ error: 'Conversation not found.' })
      return
    }
    const [messages, files] = await Promise.all([
      pool.query(
        `SELECT cm.id, cm.sender, cm.message, cm.attachment_id, cm.created_at,
                mf.original_filename AS attachment_name
         FROM chat_messages cm
         LEFT JOIN medical_files mf ON mf.id = cm.attachment_id AND mf.user_id = $2
         WHERE cm.session_id = $1
         ORDER BY cm.created_at ASC`,
        [sessionId.data, req.user.id],
      ),
      pool.query(
        `SELECT id, original_filename, file_type, file_size, analysis, created_at
         FROM medical_files
         WHERE user_id = $1 AND chat_session_id = $2
         ORDER BY created_at DESC`,
        [req.user.id, sessionId.data],
      ),
    ])
    res.json({ session: sessionResult.rows[0], messages: messages.rows, files: files.rows })
  } catch (error) {
    next(error)
  }
}

export async function postChatMessage(req, res, next) {
  const sessionId = z.string().uuid().safeParse(req.params.sessionId)
  const parsedMessage = messageSchema.safeParse(req.body)
  if (!sessionId.success) {
    res.status(400).json({ error: 'Invalid conversation ID.' })
    return
  }
  if (!parsedMessage.success) {
    res.status(400).json({ error: parsedMessage.error.issues[0]?.message ?? 'Enter a message.' })
    return
  }

  try {
    const { prediction, messages } = await buildContext(sessionId.data, req.user.id)
    const userText = parsedMessage.data.message
    const immediateSafety = urgentSafetyResponse(userText)
    const userMessage = await pool.query(
      `INSERT INTO chat_messages (session_id, sender, message)
       VALUES ($1, 'user', $2) RETURNING id, sender, message, created_at`,
      [sessionId.data, userText],
    )
    await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 AND user_id = $2', [sessionId.data, req.user.id])

    let assistantText = immediateSafety
    if (!assistantText) {
      try {
        assistantText = await requestAiText([
          {
            role: 'system',
            content: [
              'You are an AI health-information assistant, not a doctor. Provide educational explanations only; never diagnose, prescribe, recommend stopping or changing medication, or invent findings.',
              'Explain uncertainty. Encourage a qualified healthcare professional for medical decisions. For urgent symptoms, advise timely emergency care.',
              `Assessment context (untrusted clinical inputs): ${JSON.stringify(prediction)}`,
            ].join(' '),
          },
          ...messages.map(item => ({ role: item.sender === 'assistant' ? 'assistant' : 'user', content: item.message })),
          { role: 'user', content: userText },
        ], { maxTokens: 700 })
      } catch (error) {
        if (error.statusCode) {
          res.status(error.statusCode).json({ error: `${error.message} Your question has been saved to this chat.` })
          return
        }
        throw error
      }
    }

    const responseMessage = await pool.query(
      `INSERT INTO chat_messages (session_id, sender, message)
       VALUES ($1, 'assistant', $2) RETURNING id, sender, message, created_at`,
      [sessionId.data, assistantText],
    )
    await pool.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 AND user_id = $2', [sessionId.data, req.user.id])
    res.status(201).json({ userMessage: userMessage.rows[0], assistantMessage: responseMessage.rows[0] })
  } catch (error) {
    next(error)
  }
}

export async function buildContext(sessionId, userId) {
  const session = await pool.query(
    `SELECT cs.id, cs.prediction_id, cs.clinical_intake_id,
            COALESCE(p.disease, ci.disease) AS disease,
            COALESCE(p.input_data, ci.input_data) AS input_data,
            ci.derived_data, COALESCE(p.risk_percentage, ci.risk_percentage) AS risk_percentage,
            COALESCE(p.risk_level, ci.risk_level) AS risk_level,
            COALESCE(p.model_version, ci.model_version) AS model_version
     FROM chat_sessions cs
     LEFT JOIN predictions p ON p.id = cs.prediction_id AND p.user_id = cs.user_id
     LEFT JOIN clinical_intakes ci ON ci.id = cs.clinical_intake_id AND ci.user_id = cs.user_id
     WHERE cs.id = $1 AND cs.user_id = $2`,
    [sessionId, userId],
  )
  if (!session.rowCount) {
    const error = new Error('Conversation not found.')
    error.statusCode = 404
    throw error
  }
  const row = session.rows[0]
  const [history, files] = await Promise.all([
    pool.query(
      `SELECT sender, message FROM (
         SELECT sender, message, created_at FROM chat_messages WHERE session_id = $1
         ORDER BY created_at DESC LIMIT 20
       ) recent ORDER BY created_at ASC`,
      [sessionId],
    ),
    pool.query(
      `SELECT original_filename, analysis
       FROM medical_files
       WHERE user_id = $1 AND chat_session_id = $2 AND analysis IS NOT NULL
       ORDER BY created_at DESC LIMIT 5`,
      [userId, sessionId],
    ),
  ])
  return {
    prediction: {
      disease: row.disease,
      inputs: row.input_data,
      derivedMeasurements: row.derived_data,
      researchEstimatePercent: row.risk_percentage === null ? null : Number(row.risk_percentage),
      modelVersion: row.model_version,
      riskEstimateAvailable: row.risk_percentage !== null,
      syntheticScoreBand: row.risk_level,
      documents: files.rows.map(file => ({ filename: file.original_filename, analysis: file.analysis })),
    },
    messages: history.rows,
    predictionId: row.prediction_id,
    clinicalIntakeId: row.clinical_intake_id,
  }
}
