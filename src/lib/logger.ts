import { redactSensitive } from './log-sanitize.ts'

type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

function send(level: LogLevel, message: string, context?: LogContext) {
  if (typeof window === 'undefined') return

  const payload = JSON.stringify({
    level,
    message,
    path: window.location.pathname,
    context: context ? redactSensitive(context) : undefined,
  })

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/client-log', new Blob([payload], { type: 'application/json' }))
    } else {
      fetch('/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // Logger өөрөө бүтэлгүйтвэл аппын үндсэн урсгалыг тасалдуулахгүй.
  }
}

// Бүх амжилттай/амжилтгүй үйлдлийг энэ logger-оор дамжуулж backend/Grafana-с
// харагдах болгоно. context дотор password/token г.м. талбар дамжуулбал
// redactSensitive автоматаар нууцлана — гэхдээ дуудагч тал нарийн бичвэрийг
// (form утга, header) шууд дамжуулахаас зайлсхийх ёстой.
export const logger = {
  info: (message: string, context?: LogContext) => send('info', message, context),
  warn: (message: string, context?: LogContext) => send('warn', message, context),
  error: (message: string, context?: LogContext) => send('error', message, context),
}
