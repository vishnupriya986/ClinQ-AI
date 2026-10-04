import bcrypt from 'bcryptjs'
import { pool } from '../database/pool.js'
import { authCookieOptions, AUTH_COOKIE_NAME, signAuthToken } from '../utils/auth.js'

const BCRYPT_COST = 12

export async function register(req, res, next) {
  const { fullName, email, password } = req.validatedBody
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, created_at`,
      [fullName.trim(), email.toLowerCase(), passwordHash],
    )
    res.status(201).json({ message: 'Account created successfully.', user: toPublicUser(result.rows[0]) })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      res.status(409).json({ error: 'An account with this email already exists.' })
      return
    }
    next(error)
  }
}

export async function login(req, res, next) {
  const { email, password } = req.validatedBody
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, password_hash, created_at FROM users WHERE email = $1',
      [email.toLowerCase()],
    )
    const user = result.rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }
    res.cookie(AUTH_COOKIE_NAME, signAuthToken(user.id), authCookieOptions())
    res.json({ message: 'Signed in successfully.', user: toPublicUser(user) })
  } catch (error) {
    next(error)
  }
}

export function logout(_req, res) {
  const { maxAge: _maxAge, ...cookieOptions } = authCookieOptions()
  res.clearCookie(AUTH_COOKIE_NAME, cookieOptions)
  res.json({ message: 'Signed out successfully.' })
}

export async function currentUser(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, created_at FROM users WHERE id = $1',
      [req.user.id],
    )
    if (!result.rowCount) {
      res.status(401).json({ error: 'Your account could not be found. Please sign in again.' })
      return
    }
    res.json({ user: toPublicUser(result.rows[0]) })
  } catch (error) {
    next(error)
  }
}

function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    createdAt: user.created_at,
  }
}
