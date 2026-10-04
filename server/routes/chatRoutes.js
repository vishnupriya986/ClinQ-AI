import { Router } from 'express'
import { getChatSession, listChatSessions, postChatMessage } from '../controllers/chatController.js'
import { uploadAndAnalyze } from '../controllers/fileController.js'
import { authenticate } from '../middleware/authenticate.js'
import { documentUpload } from '../middleware/documentUpload.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
router.use(authenticate)
router.get('/', asyncHandler(listChatSessions))
router.get('/:sessionId', asyncHandler(getChatSession))
router.post('/:sessionId/messages', asyncHandler(postChatMessage))
router.post('/:sessionId/files', documentUpload.single('file'), asyncHandler(uploadAndAnalyze))
export default router
