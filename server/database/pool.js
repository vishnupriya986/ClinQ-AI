import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

const { Pool } = pg
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.')
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', error => {
  console.error('Unexpected idle PostgreSQL client error:', error.message)
})
