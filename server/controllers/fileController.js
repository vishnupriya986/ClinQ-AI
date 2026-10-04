import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { fileTypeFromBuffer } from 'file-type'
import { z } from 'zod'
import { pool } from '../database/pool.js'
import { AiServiceError, requestDocumentAnalysis } from '../services/aiService.js'
import { buildContext } from './chatController.js'

const serverRoot = fileURLToPath(new URL('../', import.meta.url))
const uploadsRoot = path.resolve(serverRoot, 'uploads')

function errorWithStatus(message, statusCode) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

export async function uploadAndAnalyze(req, res, next) {
  const sessionId = z.string().uuid().safeParse(req.params.sessionId)
  if (!sessionId.success) {
    res.status(400).json({ error: 'Invalid conversation ID.' })
    return
  }
  if (!req.file) {
    res.status(400).json({ error: 'Choose a PDF, JPG, JPEG, or PNG medical document.' })
    return
  }
  if (req.body.aiConsent !== 'true') {
    res.status(400).json({ error: 'Confirm consent before sending this medical document to the configured AI provider.' })
    return
  }
  try {
    const { prediction, predictionId, clinicalIntakeId } = await buildContext(sessionId.data, req.user.id)
    const contentType = await validateDocument(req.file)
    let extractedText = ''
    if (contentType === 'application/pdf') {
      const parsedPdf = await pdfParse(req.file.buffer, { max: 20 })
      extractedText = parsedPdf.text.trim().slice(0, 20_000)
      if (!extractedText) {
        throw errorWithStatus('No readable text was found in this PDF. Image-only PDFs are not supported; upload a JPG or PNG instead.', 422)
      }
    }
    const storedFilename = `${randomUUID()}.${contentType === 'application/pdf' ? 'pdf' : contentType === 'image/png' ? 'png' : 'jpg'}`
    const userDirectory = path.join(uploadsRoot, req.user.id)
    const filePath = path.join(userDirectory, storedFilename)
    await mkdir(userDirectory, { recursive: true })
    await writeFile(filePath, req.file.buffer, { flag: 'wx', mode: 0o600 })

    let savedFile
    let savedUserMessage
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const fileResult = await client.query(
        `INSERT INTO medical_files
           (user_id, prediction_id, clinical_intake_id, chat_session_id, original_filename, stored_filename, file_type, file_size, file_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, original_filename, file_type, file_size, analysis, created_at`,
        [
          req.user.id,
          predictionId,
          clinicalIntakeId,
          sessionId.data,
          path.basename(req.file.originalname.replaceAll('\\', '/')).slice(0, 255),
          storedFilename,
          contentType,
          req.file.size,
          filePath,
        ],
      )
      savedFile = fileResult.rows[0]
      const userMessage = await client.query(
        `INSERT INTO chat_messages (session_id, sender, message, attachment_id)
         VALUES ($1, 'user', $2, $3) RETURNING id, sender, message, attachment_id, created_at`,
        [sessionId.data, `Please analyze the uploaded document: ${savedFile.original_filename}`, savedFile.id],
      )
      savedUserMessage = { ...userMessage.rows[0], attachment_name: savedFile.original_filename }
      await client.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 AND user_id = $2', [sessionId.data, req.user.id])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      await unlink(filePath).catch(cleanupError => console.error('Could not remove failed upload:', cleanupError.message))
      throw error
    } finally {
      client.release()
    }

    let analysisText
    try {
      analysisText = await requestDocumentAnalysis({
        buffer: req.file.buffer,
        contentType,
        extractedText,
        context: JSON.stringify(prediction),
      })
    } catch (error) {
      if (!(error instanceof AiServiceError)) throw error
      console.error('Medical document analysis failed:', error.message)
      res.status(201).json({
        file: savedFile,
        userMessage: savedUserMessage,
        analysisError: `${error.message} The uploaded file and your request were saved; re-upload it after AI service is configured to analyze it.`,
      })
      return
    }

    const analysisClient = await pool.connect()
    try {
      await analysisClient.query('BEGIN')
      const analysis = { text: analysisText, analyzedAt: new Date().toISOString() }
      await analysisClient.query('UPDATE medical_files SET analysis = $1 WHERE id = $2 AND user_id = $3', [
        JSON.stringify(analysis), savedFile.id, req.user.id,
      ])
      const assistantMessage = await analysisClient.query(
        `INSERT INTO chat_messages (session_id, sender, message, attachment_id)
         VALUES ($1, 'assistant', $2, $3) RETURNING id, sender, message, attachment_id, created_at`,
        [sessionId.data, analysisText, savedFile.id],
      )
      await analysisClient.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 AND user_id = $2', [sessionId.data, req.user.id])
      await analysisClient.query('COMMIT')
      res.status(201).json({
        file: { ...savedFile, analysis },
        userMessage: savedUserMessage,
        assistantMessage: { ...assistantMessage.rows[0], attachment_name: savedFile.original_filename },
      })
    } catch (error) {
      await analysisClient.query('ROLLBACK')
      throw error
    } finally {
      analysisClient.release()
    }
  } catch (error) {
    next(error)
  }
}

async function validateDocument(file) {
  const extension = path.extname(file.originalname).toLowerCase()
  if (file.mimetype === 'application/pdf' && extension === '.pdf' && file.buffer.subarray(0, 5).toString() === '%PDF-') {
    return 'application/pdf'
  }
  const detected = await fileTypeFromBuffer(file.buffer)
  const expected = extension === '.png' ? 'image/png' : ['.jpg', '.jpeg'].includes(extension) ? 'image/jpeg' : null
  if (!expected || file.mimetype !== expected || detected?.mime !== expected) {
    throw errorWithStatus('The uploaded file content does not match a supported PDF, JPG, or PNG file.', 415)
  }
  return expected
}

export async function downloadFile(req, res, next) {
  const fileId = z.string().uuid().safeParse(req.params.id)
  if (!fileId.success) {
    res.status(400).json({ error: 'Invalid file ID.' })
    return
  }
  try {
    const result = await pool.query(
      'SELECT original_filename, file_path FROM medical_files WHERE id = $1 AND user_id = $2',
      [fileId.data, req.user.id],
    )
    if (!result.rowCount) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    const targetPath = path.resolve(result.rows[0].file_path)
    if (!targetPath.startsWith(`${uploadsRoot}${path.sep}`)) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    res.download(targetPath, result.rows[0].original_filename, error => {
      if (error && !res.headersSent) next(error)
    })
  } catch (error) {
    next(error)
  }
}

export async function deleteFile(req, res, next) {
  const fileId = z.string().uuid().safeParse(req.params.id)
  if (!fileId.success) {
    res.status(400).json({ error: 'Invalid file ID.' })
    return
  }
  try {
    const existing = await pool.query(
      'SELECT file_path FROM medical_files WHERE id = $1 AND user_id = $2',
      [fileId.data, req.user.id],
    )
    if (!existing.rowCount) {
      res.status(404).json({ error: 'File not found.' })
      return
    }
    const targetPath = path.resolve(existing.rows[0].file_path)
    if (!targetPath.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new Error('Stored medical file path is outside the protected upload directory.')
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const locked = await client.query(
        'SELECT id FROM medical_files WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [fileId.data, req.user.id],
      )
      if (!locked.rowCount) {
        await client.query('ROLLBACK')
        res.status(404).json({ error: 'File not found.' })
        return
      }
      await unlink(targetPath)
      await client.query('DELETE FROM chat_messages WHERE attachment_id = $1', [fileId.data])
      await client.query('DELETE FROM medical_files WHERE id = $1 AND user_id = $2', [fileId.data, req.user.id])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    res.json({ message: 'File deleted.' })
  } catch (error) {
    next(error)
  }
}
