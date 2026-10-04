export async function createPrediction(req, res) {
  if (!['heart', 'diabetes', 'lung'].includes(req.params.disease)) {
    res.status(404).json({ error: 'This prediction type is not supported.' })
    return
  }
  res.status(503).json({
    error: 'Risk estimates are disabled for the current clinical intake fields until compatible, outcome-labeled models are trained and validated.',
  })
}
