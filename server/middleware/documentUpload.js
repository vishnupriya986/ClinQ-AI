import multer from 'multer'

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png'])
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
    const acceptedMime = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)
    if (!allowedExtensions.has(extension) || !acceptedMime) {
      const error = new Error('Unsupported file. Upload a PDF, JPG, JPEG, or PNG file.')
      error.statusCode = 415
      callback(error)
      return
    }
    callback(null, true)
  },
})
