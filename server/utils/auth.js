import jwt from 'jsonwebtoken'

export const AUTH_COOKIE_NAME = 'clinq_session'
export const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function signAuthToken(userId) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured.')
  return jwt.sign({ sub: userId }, secret, { expiresIn: '1d', issuer: 'clinq-ai' })
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE_MS,
  }
}
