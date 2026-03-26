// Centralized logger for debug and error output — PROJ-12
// LOG_LEVEL is read once at module load time for performance.
// Set LOG_LEVEL=debug in Vercel Environment Variables and redeploy to enable.
import 'server-only'

/**
 * Mask a sensitive token for safe log output.
 * Shows the first 8 characters followed by "..." — never the full value.
 * Returns "(empty)" for falsy values.
 */
export function maskToken(token: string | undefined | null): string {
  if (!token) return '(empty)'
  if (token.length <= 8) return '***'
  return `${token.slice(0, 8)}...`
}

/**
 * Mask an email address for safe log output.
 * "user@example.com" → "us***@example.com"
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return '(empty)'
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const visible = local.slice(0, 2)
  return `${visible}***@${domain}`
}

/**
 * Log a debug message. Only outputs when LOG_LEVEL=debug.
 * Format: [DEBUG][module] message: {data}
 */
export function debug(module: string, message: string, data?: unknown): void {
  if (process.env.LOG_LEVEL !== 'debug') return
  if (data !== undefined) {
    console.log(`[DEBUG][${module}] ${message}:`, typeof data === 'string' ? data : JSON.stringify(data))
  } else {
    console.log(`[DEBUG][${module}] ${message}`)
  }
}

/**
 * Log an error. Always outputs regardless of LOG_LEVEL.
 */
export function error(module: string, message: string, err?: unknown): void {
  if (err !== undefined) {
    console.error(`[ERROR][${module}] ${message}:`, err)
  } else {
    console.error(`[ERROR][${module}] ${message}`)
  }
}
