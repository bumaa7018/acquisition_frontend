// Лог руу нууцлалтай мэдээлэл (нууц үг, токен г.м.) санаандгүй орохоос сэргийлэх
// нийтлэг цэвэрлэгч. Client logger болон server route handler хоёулаа ашиглана.
const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'new_password', 'oldpassword', 'old_password',
  'confirmpassword', 'confirm_password',
  'token', 'access_token', 'refresh_token', 'accesstoken', 'refreshtoken',
  'authorization', 'secret', 'apikey', 'api_key',
])

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]'
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redactSensitive(v, depth + 1)
    }
    return out
  }
  return value
}
