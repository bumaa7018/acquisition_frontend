import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/session-guard";

export const runtime = "nodejs";

// httpOnly session cookie-г тохируулах/цэвэрлэх. Client (auth.ts) нь login
// болон token refresh бүрд POST-оор дуудаж, гарах үед DELETE хийнэ.
//
// Cookie нь access token-ыг агуулна (httpOnly тул JS уншихгүй). Доторх token
// 15 мин-д хүчингүй болдог тул setTokens бүрд шинэчлэгдэнэ; cookie-ийн Max-Age
// нь refresh TTL-тэй тэнцүү (7 хоног) — идэвхтэй хэрэглээнд синк хэвээр.

function isHttps(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isHttps(req),
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isHttps(req),
    maxAge: 0,
  });
  return res;
}
