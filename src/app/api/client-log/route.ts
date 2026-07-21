import { NextRequest, NextResponse } from "next/server";
import { redactSensitive } from "@/lib/log-sanitize";

export const runtime = "nodejs";

const LEVEL_ORDER: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const THRESHOLD = LEVEL_ORDER[(process.env.LOG_LEVEL ?? "info").toLowerCase()] ?? 1;

// Browser-с ирсэн амжилттай/амжилтгүй үйлдлийн логыг Next сервэрийн stdout руу
// бичнэ — энэ container-ийн stdout-г Promtail Loki руу дамжуулна. Тиймээс шинэ
// backend endpoint, шинэ хадгалалт шаардлагагүй, зөвхөн энэ л route дамждаг.
export async function POST(req: NextRequest) {
  let body: { level?: string; message?: string; path?: string; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const level = LEVEL_ORDER[body.level ?? ""] !== undefined ? (body.level as string) : "info";
  if ((LEVEL_ORDER[level] ?? 1) < THRESHOLD) {
    return NextResponse.json({ ok: true });
  }

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level: level.toUpperCase(),
    msg: body.message ?? "client event",
    path: body.path,
    // context-ийг дахин цэвэрлэнэ — client талын redact алгасагдсан ч энд
    // нууц үг/токен шиг талбар хэзээ ч дискэнд бичигдэхгүй байхын баталгаа.
    context: body.context ? redactSensitive(body.context) : undefined,
    source: "frontend-client",
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  return NextResponse.json({ ok: true });
}
