import { NextRequest, NextResponse } from "next/server";
import { redactSensitive } from "@/lib/log-sanitize";

export const runtime = "nodejs";

const LEVEL_ORDER: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const THRESHOLD = LEVEL_ORDER[(process.env.LOG_LEVEL ?? "info").toLowerCase()] ?? 1;

// Клиентийн лог бол зөвхөн богино мета-мэдээлэл (алдааны мессеж, key/status)
// байх ёстой — файл/бие орохгүй. Хэт том эсвэл хэт олон хүсэлт Next серверийн
// process-ийг ачаалахаас (CPU/санах ой) сэргийлж хатуу хязгаар тавина.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_CHARS = 500;
const MAX_CONTEXT_CHARS = 2000;

// Энгийн in-memory rate limit (IP тутамд минутанд N хүсэлт). Process дахин
// асахад тэглэгдэнэ — DoS/буруу клиентээс сервэрийг хамгаалах зорилготой,
// нарийн тоолол биш.
const RATE_LIMIT_PER_MINUTE = 120;
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    // Хуучирсан bucket-уудыг тогтмол цэвэрлэж, map хязгааргүй өсөхөөс сэргийлнэ.
    if (buckets.size > 5000) {
      buckets.forEach((e, key) => {
        if (now - e.windowStart > WINDOW_MS) buckets.delete(key);
      });
    }
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

// Browser-с ирсэн амжилттай/амжилтгүй үйлдлийн логыг Next сервэрийн stdout руу
// бичнэ — энэ container-ийн stdout-г Promtail Loki руу дамжуулна. Тиймээс шинэ
// backend endpoint, шинэ хадгалалт шаардлагагүй, зөвхөн энэ л route дамждаг.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let body: { level?: string; message?: string; path?: string; context?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const level = LEVEL_ORDER[body.level ?? ""] !== undefined ? (body.level as string) : "info";
  if ((LEVEL_ORDER[level] ?? 1) < THRESHOLD) {
    return NextResponse.json({ ok: true });
  }

  const message = String(body.message ?? "client event").slice(0, MAX_MESSAGE_CHARS);
  // context-ийг дахин цэвэрлэнэ — client талын redact алгасагдсан ч энд
  // нууц үг/токен шиг талбар хэзээ ч дискэнд бичигдэхгүй байхын баталгаа.
  const context = body.context
    ? JSON.stringify(redactSensitive(body.context)).slice(0, MAX_CONTEXT_CHARS)
    : undefined;

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level: level.toUpperCase(),
    msg: message,
    path: typeof body.path === "string" ? body.path.slice(0, 300) : undefined,
    context,
    source: "frontend-client",
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  return NextResponse.json({ ok: true });
}
