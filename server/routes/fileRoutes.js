import { Router } from 'express'
import { deleteFile, downloadFile } from '../controllers/fileController.js'
import { authenticate } from '../middleware/authenticate.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
router.use(authenticate)
router.get('/:id', asyncHandler(downloadFile))
router.delete('/:id', asyncHandler(deleteFile))
export default router
