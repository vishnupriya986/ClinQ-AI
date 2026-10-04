export function classifySyntheticScore(percentage) {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new RangeError('Synthetic score percentage must be between 0 and 100.')
  }
  if (percentage < 30) return 'Low'
  if (percentage < 60) return 'Medium'
  return 'High'
}
