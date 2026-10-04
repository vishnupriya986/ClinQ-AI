export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'The requested resource was not found.' })
}

export function errorHandler(error, _req, res, next) {
  if (error?.name === 'MulterError') {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE'
    res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'File exceeds the 10 MB upload limit.' : 'The file upload could not be accepted.',
    })
    return
  }
  if (error && typeof error === 'object' && 'statusCode' in error && Number.isInteger(error.statusCode)) {
    res.status(error.statusCode).json({ error: error.message })
    return
  }
  if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'The request body contains invalid JSON.' })
      return
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'The request body is too large.' })
      return
    }
  }
  console.error('Unhandled API error:', error instanceof Error ? error.message : 'Unknown error')
  if (res.headersSent) {
    next(error)
    return
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' })
}
