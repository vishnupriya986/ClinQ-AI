import { Router } from 'express'
import { z } from 'zod'
import { currentUser, login, logout, register } from '../controllers/authController.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()
const registrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters.').max(100, 'Full name must be 100 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(254, 'Email must be 254 characters or fewer.'),
  password: z.string()
    .min(10, 'Password must be at least 10 characters.')
    .regex(/[a-z]/, 'Password must include a lowercase letter.')
    .regex(/[A-Z]/, 'Password must include an uppercase letter.')
    .regex(/[0-9]/, 'Password must include a number.')
    .refine(password => Buffer.byteLength(password, 'utf8') <= 72, 'Password must be 72 bytes or fewer.'),
})
const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string()
    .min(1, 'Password is required.')
    .refine(password => Buffer.byteLength(password, 'utf8') <= 72, 'Password must be 72 bytes or fewer.'),
})

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Please check your submitted information.' })
      return
    }
    req.validatedBody = parsed.data
    next()
  }
}

router.post('/register', validate(registrationSchema), register)
router.post('/login', validate(loginSchema), login)
router.post('/logout', logout)
router.get('/me', authenticate, currentUser)

export default router
