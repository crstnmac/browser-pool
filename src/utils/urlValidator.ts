import { URL } from 'url'
import dns from 'dns/promises'
import { logger } from '../logger.js'

export interface URLValidationResult {
  allowed: boolean
  reason?: string
}

/**
 * Check if URL is safe to fetch (SSRF protection)
 */
export async function isAllowedURL(urlString: string): Promise<URLValidationResult> {
  try {
    const url = new URL(urlString)

    // 1. Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        allowed: false,
        reason: 'Only HTTP and HTTPS protocols are allowed'
      }
    }

    // 2. Block private/internal IP ranges in hostname
    const hostname = url.hostname

    // Block localhost variants
    if (/^(localhost|127\.|::1|0\.0\.0\.0)$/i.test(hostname)) {
      return {
        allowed: false,
        reason: 'Localhost addresses are not allowed'
      }
    }

    // Block private IPv4 ranges
    const privateIPv4Ranges = [
      /^10\./,                          // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
      /^192\.168\./,                    // 192.168.0.0/16
      /^169\.254\./,                    // 169.254.0.0/16 (link-local)
      /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // 100.64.0.0/10 (CGNAT)
    ]

    if (privateIPv4Ranges.some(range => range.test(hostname))) {
      return {
        allowed: false,
        reason: 'Private IP addresses are not allowed'
      }
    }

    // Block private IPv6 ranges
    const privateIPv6Ranges = [
      /^fe80:/i,  // Link-local
      /^fc00:/i,  // Private
      /^fd00:/i,  // Private
      /^::1$/i,   // Localhost
    ]

    if (privateIPv6Ranges.some(range => range.test(hostname))) {
      return {
        allowed: false,
        reason: 'Private IPv6 addresses are not allowed'
      }
    }

    // 3. Block cloud metadata endpoints
    const blockedHosts = [
      'metadata.google.internal',
      '169.254.169.254',
      'fd00:ec2::254', // AWS IPv6
      'instance-data',
      'metadata',
    ]

    if (blockedHosts.some(blocked => hostname.toLowerCase().includes(blocked))) {
      return {
        allowed: false,
        reason: 'Access to cloud metadata services is not allowed'
      }
    }

    // 4. Resolve DNS and check if it points to private IP (DNS rebinding protection)
    try {
      const addresses = await dns.resolve4(hostname).catch(() => [])

      for (const addr of addresses) {
        if (privateIPv4Ranges.some(range => range.test(addr))) {
          logger.warn('DNS resolved to private IP', { hostname, resolved: addr })
          return {
            allowed: false,
            reason: 'Domain resolves to private IP address (DNS rebinding protection)'
          }
        }

        // Also block cloud metadata IPs
        if (addr === '169.254.169.254') {
          return {
            allowed: false,
            reason: 'Domain resolves to cloud metadata IP'
          }
        }
      }
    } catch (error) {
      // DNS resolution failed - could be IPv6 only or DNS error
      logger.debug('DNS resolution failed for hostname', { hostname, error })
      // Don't fail on DNS errors, but log for monitoring
    }

    // 5. Check for suspicious patterns
    const suspiciousPatterns = [
      /\d+\.\d+\.\d+\.\d+.*@/, // URL with embedded IP (e.g., http://attacker@192.168.1.1)
      /@.*\d+\.\d+\.\d+\.\d+/, // IP after @ symbol
      /^(\d+\.){3}\d+@/,       // IP before @ symbol
    ]

    if (suspiciousPatterns.some(pattern => pattern.test(urlString))) {
      return {
        allowed: false,
        reason: 'Suspicious URL pattern detected'
      }
    }

    // 6. Additional browser-specific checks
    const dangerousPatterns = [
      'javascript:',
      'data:',
      'file:',
      '<script',
      'vbscript:',
    ]

    const lowerUrl = urlString.toLowerCase()
    if (dangerousPatterns.some(pattern => lowerUrl.includes(pattern))) {
      return {
        allowed: false,
        reason: 'Potentially dangerous URL content detected'
      }
    }

    return { allowed: true }
  } catch (error: any) {
    return {
      allowed: false,
      reason: `Invalid URL format: ${error.message}`
    }
  }
}

/**
 * Validate and sanitize URL (remove credentials, normalize)
 */
export function sanitizeURL(urlString: string): string {
  try {
    const url = new URL(urlString)

    // Remove credentials from URL
    url.username = ''
    url.password = ''

    // Normalize
    return url.toString()
  } catch (error) {
    throw new Error('Invalid URL')
  }
}

/**
 * Check if hostname is an IP address
 */
export function isIPAddress(hostname: string): boolean {
  // IPv4
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Pattern.test(hostname)) {
    return true
  }

  // IPv6 (simplified check)
  if (hostname.includes(':') && /^[0-9a-f:]+$/i.test(hostname)) {
    return true
  }

  return false
}
