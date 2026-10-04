export function validateEnvironment() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.')
  }
  if (!process.env.CLIENT_URL) {
    throw new Error('CLIENT_URL must be configured.')
  }
}
