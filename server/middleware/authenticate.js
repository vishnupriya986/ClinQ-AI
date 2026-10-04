import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_NAME } from '../utils/auth.js'

export function authenticate(req, res, next) {
  const token = req.cookies[AUTH_COOKIE_NAME]
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'clinq-ai' })
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      res.status(401).json({ error: 'Your session is invalid. Please sign in again.' })
      return
    }
    req.user = { id: decoded.sub }
    next()
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}
