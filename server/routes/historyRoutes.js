import { Router } from 'express'
import { getPrediction, listPredictions } from '../controllers/historyController.js'
import { authenticate } from '../middleware/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
router.use(authenticate)
router.get('/', asyncHandler(listPredictions))
router.get('/:id', asyncHandler(getPrediction))
export default router
