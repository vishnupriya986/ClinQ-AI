import { Router } from 'express'
import { dashboardSummary } from '../controllers/dashboardController.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()
router.get('/', authenticate, dashboardSummary)
export default router
