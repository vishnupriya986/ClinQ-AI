const models = {
  heart: 'heart_uci_cleveland_v1',
  diabetes: 'diabetes_uci_early_symptoms_v1',
}
const syntheticModels = {
  heart: 'heart_synthetic_logistic_platt_v1',
  lung: 'lung_synthetic_logistic_platt_v1',
  diabetes: 'diabetes_synthetic_logistic_platt_v1',
}

export async function requestEstimate(disease, inputs) {
  if (disease === 'lung') {
    const error = new Error('Lung prediction is disabled until a suitable case-control dataset is selected.')
    error.statusCode = 503
    throw error
  }
  const baseUrl = process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8000'
  let response
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/predict/${disease}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    const error = new Error('The research model service is unavailable. Start the ML service and try again.')
    error.statusCode = 503
    throw error
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.detail ?? 'The model could not complete this assessment.')
    error.statusCode = response.status
    throw error
  }
  if (result.disease !== disease || !Number.isFinite(result.estimate) || result.estimate < 0 || result.estimate > 1) {
    throw new Error('The model service returned an invalid estimate.')
  }
  if (result.modelVersion !== models[disease]) {
    throw new Error('The model service version does not match the expected dataset model.')
  }
  return result
}

export async function requestSyntheticEstimate(disease, inputs, derivedInputs) {
  const baseUrl = process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8000'
  let response
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/predict-synthetic/${disease}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: { ...inputs, ...derivedInputs } }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    const error = new Error('The synthetic-data model service is unavailable. Start or restart the ML service and try again.')
    error.statusCode = 503
    throw error
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.detail ?? 'The synthetic-data model could not complete this assessment.')
    error.statusCode = response.status
    throw error
  }
  if (
    result.disease !== disease
    || !Number.isFinite(result.estimate)
    || result.estimate < 0
    || result.estimate > 1
  ) {
    throw new Error('The synthetic-data model service returned an invalid estimate.')
  }
  if (result.modelVersion !== syntheticModels[disease]) {
    throw new Error('The synthetic-data model version does not match the expected model.')
  }
  return result
}
