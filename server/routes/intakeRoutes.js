import { Router } from 'express'
import { createClinicalIntake, getClinicalIntake, listClinicalIntakes } from '../controllers/intakeController.js'
import { authenticate } from '../middleware/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
router.use(authenticate)
router.get('/', asyncHandler(listClinicalIntakes))
router.post('/:disease', asyncHandler(createClinicalIntake))
router.get('/:id', asyncHandler(getClinicalIntake))
export default router
