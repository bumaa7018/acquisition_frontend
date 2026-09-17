import test from "node:test";
import assert from "node:assert/strict";
import { accessTokenExpiresAt } from "../src/lib/auth.ts";

// JWT-ийн payload хэсгийг base64url-ээр бүтээнэ (гарын үсэг шалгагдахгүй тул
// header/signature нь дурын утга байж болно).
function jwt(payload) {
  const b64 = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `hdr.${b64}.sig`;
}

test("accessTokenExpiresAt: exp-ийг миллисекунд болгож буцаана", () => {
  const exp = 1_760_000_000; // секунд
  assert.equal(accessTokenExpiresAt(jwt({ exp })), exp * 1000);
});

test("accessTokenExpiresAt: exp байхгүй бол null", () => {
  assert.equal(accessTokenExpiresAt(jwt({ user_id: "8" })), null);
});

test("accessTokenExpiresAt: exp тоо биш бол null", () => {
  assert.equal(accessTokenExpiresAt(jwt({ exp: "1760000000" })), null);
  assert.equal(accessTokenExpiresAt(jwt({ exp: null })), null);
});

test("accessTokenExpiresAt: буруу/хоосон токенд null (алдаа шидэхгүй)", () => {
  assert.equal(accessTokenExpiresAt(null), null);
  assert.equal(accessTokenExpiresAt(""), null);
  assert.equal(accessTokenExpiresAt("энэ.бол.jwt-биш"), null);
});

// Урьдчилан сэргээх таймерын тооцоолол: хугацаа дуусахаас 60 секундын өмнө
// ажиллах ёстой бөгөөд аль хэдийн дууссан токен дээр сөрөг хүлээлт гаргахгүй.
// (session-refresh.ts дэх томьёоны инвариант — DOM шаардахгүй тул энд шалгав.)
const REFRESH_LEAD_MS = 60_000;
const MIN_DELAY_MS = 1_000;
const delayFor = (expiresAt, now) =>
  Math.max(MIN_DELAY_MS, expiresAt - now - REFRESH_LEAD_MS);

test("сэргээх хүлээлт: 15 минутын токенд ~14 минут", () => {
  const now = 1_000_000;
  assert.equal(delayFor(now + 15 * 60_000, now), 14 * 60_000);
});

test("сэргээх хүлээлт: хугацаа дууссан/ойрхон үед хамгийн багадаа 1 сек", () => {
  const now = 1_000_000;
  assert.equal(delayFor(now - 60_000, now), MIN_DELAY_MS); // аль хэдийн дууссан
  assert.equal(delayFor(now + 30_000, now), MIN_DELAY_MS); // 60 сек-ээс ойр
});
