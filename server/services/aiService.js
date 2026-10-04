const URGENT_SYMPTOMS = /\b(severe chest pain|chest pain.{0,30}(shortness of breath|sweating|faint|nausea)|can't breathe|cannot breathe|severe difficulty breathing|stroke|face droop|sudden weakness|unconscious|overdose|suicid)\b/i

export class AiServiceError extends Error {
  constructor(message, statusCode = 503) {
    super(message)
    this.name = 'AiServiceError'
    this.statusCode = statusCode
  }
}

function configuration() {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL
  const baseUrl = process.env.OPENAI_BASE_URL
  if (!apiKey || !model || !baseUrl) {
    throw new AiServiceError('AI is not configured. Set OPENAI_API_KEY, OPENAI_MODEL, and OPENAI_BASE_URL on the backend.')
  }
  return { apiKey, model, baseUrl: baseUrl.replace(/\/$/, '') }
}

export function urgentSafetyResponse(message) {
  return URGENT_SYMPTOMS.test(message)
    ? 'Your message mentions symptoms that may need urgent attention. I cannot assess or diagnose an emergency. Please contact your local emergency service now or seek urgent medical care, especially for severe chest pain, difficulty breathing, fainting, or sudden weakness. Do not wait for an online response.'
    : null
}

export async function requestAiText(messages, { temperature = 0.2, maxTokens = 900 } = {}) {
  const { apiKey, model, baseUrl } = configuration()
  let response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new AiServiceError('The AI service could not be reached. Please try again later.', 503)
  }
  if (!response.ok) {
    const status = response.status
    const providerError = await response.json().catch(() => null)
    const providerMessage = providerError?.error?.message
    if (typeof providerMessage === 'string') {
      console.error('Configured AI provider returned HTTP', status, '-', providerMessage.slice(0, 300))
    } else {
      console.error('Configured AI provider returned HTTP', status)
    }
    throw new AiServiceError('The AI service is temporarily unavailable. Please try again later.', 503)
  }
  let result
  try {
    result = await response.json()
  } catch {
    throw new AiServiceError('The AI provider returned an unreadable response. Please try again.')
  }
  if (result?.error) {
    const providerMessage = typeof result.error.message === 'string' ? result.error.message.slice(0, 300) : ''
    console.error('Configured AI provider returned an error in its response.', providerMessage)
    throw new AiServiceError('The AI provider could not complete this request. Check the model availability and provider settings.')
  }

  const choice = result?.choices?.[0]
  const message = choice?.message
  const content = normalizeTextContent(message?.content)
  if (content) return content

  if (typeof message?.refusal === 'string' && message.refusal.trim()) {
    return message.refusal.trim()
  }

  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'no choice returned'
  console.error('Configured AI provider returned no text content. Finish reason:', finishReason)
  throw new AiServiceError(
    finishReason === 'length'
      ? 'The AI provider response was cut off before it returned an answer. Please try again.'
      : 'The selected model returned no text answer. Try another available model or try again later.',
  )
}

function normalizeTextContent(content) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''

  return content
    .filter(part => part && (part.type === 'text' || typeof part.text === 'string') && typeof part.text === 'string')
    .map(part => part.text.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

export async function requestDocumentAnalysis({ buffer, contentType, extractedText, context }) {
  const system = [
    'You explain healthcare documents for general educational information, not medical diagnosis or treatment.',
    'Separate facts that are explicitly readable in the supplied document from your general interpretation.',
    'Use these headings in your response: "Explicitly present in the document", "General AI-generated interpretation", and "Questions to discuss with a qualified healthcare professional".',
    'Never invent missing names, dates, results, units, reference ranges, or findings. Say when text or image details are unreadable or uncertain.',
    'For laboratory values, only call a value outside range when the document itself provides a readable reference range or marks it abnormal.',
    'Do not tell the user to start, stop, or change medication or dosage. Encourage a qualified clinician to interpret results and prescriptions.',
    'For X-rays and other medical images, explain visible content only as tentative; do not diagnose or claim to replace a radiologist.',
    'If a finding could require urgent attention, clearly advise timely professional assessment without diagnosing.',
  ].join(' ')
  const userContent = []
  userContent.push({
    type: 'text',
    text: `Document context: ${context}\n\n${extractedText ? `Extracted text (untrusted document content):\n${extractedText}` : 'No machine-readable text was extracted; inspect only the attached image if visual input is available.'}`,
  })
  if (contentType.startsWith('image/')) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${contentType};base64,${buffer.toString('base64')}`, detail: 'high' },
    })
  }
  return requestAiText([
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ], { maxTokens: 1200 })
}
