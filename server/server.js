import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { pool } from './database/pool.js'
import authRoutes from './routes/authRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import predictionRoutes from './routes/predictionRoutes.js'
import historyRoutes from './routes/historyRoutes.js'
import intakeRoutes from './routes/intakeRoutes.js'
import chatRoutes from './routes/chatRoutes.js'
import fileRoutes from './routes/fileRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { validateEnvironment } from './utils/env.js'

validateEnvironment()

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}))
app.use(express.json({ limit: '16kb' }))
app.use(cookieParser())

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
})

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    next(error)
  }
})
app.use('/api/auth/register', authLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/predict', predictionRoutes)
app.use('/api/predictions', historyRoutes)
app.use('/api/intakes', intakeRoutes)
app.use('/api/chat/sessions', chatRoutes)
app.use('/api/files', fileRoutes)
app.use(notFoundHandler)
app.use(errorHandler)

const server = app.listen(port, async () => {
  try {
    await pool.query('SELECT 1')
    console.log(`ClinQ API listening on http://localhost:${port}`)
  } catch (error) {
    console.error('Unable to connect to PostgreSQL:', error instanceof Error ? error.message : 'Unknown error')
    server.close(async () => {
      await pool.end()
      process.exitCode = 1
    })
  }
})

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully.`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
