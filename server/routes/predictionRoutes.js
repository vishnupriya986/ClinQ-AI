import { Router } from 'express'
import { createPrediction } from '../controllers/predictionController.js'
import { authenticate } from '../middleware/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
router.use(authenticate)
router.post('/:disease', asyncHandler(createPrediction))
export default router
