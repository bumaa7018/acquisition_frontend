// DB рүү шууд хандаж (admin unit нэр, ажилтны нэр гэх мэт) баримт үүсгэдэг
// API route-уудад нэвтэрсэн эсэхийг шалгана. JWT-ийг өөрөө энд баталгаажуулахгүй
// (гарын үсэг шалгах түлхүүр энд байхгүй) — /report/download route-ын адил
// хэрэглэгчийн бодит эрхийг үргэлж БАРИМТЫН backend-ээр (jwt.Manager) шалгуулна;
// энд зөвхөн тухайн token-оор backend хүлээн авах эсэхийг (401/403 биш) шалгана.
const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";

export async function isAuthenticated(authorizationHeader: string | null): Promise<boolean> {
  if (!authorizationHeader) return false;
  try {
    const res = await fetch(`${BACKEND}/api/v1/users/me`, {
      headers: { Authorization: authorizationHeader },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Нэвтрэх шаардлагатай" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
