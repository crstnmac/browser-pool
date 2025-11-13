/**
 * Sanitize data for logging to prevent sensitive information leakage
 */

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'apikey',
  'api_key',
  'token',
  'secret',
  'authorization',
  'auth',
  'key',
  'credentials',
  'credit_card',
  'creditcard',
  'ssn',
  'dodo_api_key',
  'dodo_webhook_secret',
  'jwt_secret',
  'smtp_pass',
]

/**
 * Check if a key is sensitive
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase().replace(/[_-]/g, '')
  return SENSITIVE_KEYS.some(sensitiveKey =>
    lowerKey.includes(sensitiveKey.replace(/[_-]/g, ''))
  )
}

/**
 * Sanitize a single value
 */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // For strings, show first 4 chars only if long enough
    if (value.length > 8) {
      return `${value.substring(0, 4)}***`
    }
    return '***'
  }

  if (typeof value === 'object' && value !== null) {
    return sanitizeForLogging(value)
  }

  return value
}

/**
 * Recursively sanitize object for logging
 */
export function sanitizeForLogging(data: any): any {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data !== 'object') {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item))
  }

  const sanitized: any = {}

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '***REDACTED***'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Sanitize API key for logging (show only prefix)
 */
export function sanitizeApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '***'
  }

  // Show only the prefix (e.g., "bp_live_" or "bp_test_")
  const parts = apiKey.split('_')
  if (parts.length >= 2) {
    return `${parts[0]}_${parts[1]}_***`
  }

  return `${apiKey.substring(0, 4)}***`
}

/**
 * Sanitize email for logging (partial obscure)
 */
export function sanitizeEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***'
  }

  const [local, domain] = email.split('@')

  // Show first 2 chars of local part
  const sanitizedLocal = local.length > 2
    ? `${local.substring(0, 2)}***`
    : '***'

  // Show full domain (not sensitive)
  return `${sanitizedLocal}@${domain}`
}

/**
 * Sanitize IP address for logging (obscure last octet)
 */
export function sanitizeIP(ip: string): string {
  if (!ip) return '***'

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`
    }
  }

  // IPv6 (show first 4 groups)
  if (ip.includes(':')) {
    const parts = ip.split(':')
    if (parts.length >= 4) {
      return `${parts.slice(0, 4).join(':')}::***`
    }
  }

  return '***'
}

/**
 * Sanitize URL for logging (remove credentials, keep path)
 */
export function sanitizeURL(url: string): string {
  try {
    const urlObj = new URL(url)

    // Remove credentials
    urlObj.username = ''
    urlObj.password = ''

    return urlObj.toString()
  } catch {
    // If not a valid URL, return as-is
    return url
  }
}
