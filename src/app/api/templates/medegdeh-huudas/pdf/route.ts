import { NextRequest } from "next/server";
import { resolveAdminUnitNames } from "@/lib/server/admin-units";
import { isAuthenticated, unauthorizedResponse } from "@/lib/server/verify-auth";
import { buildNoticePdf } from "@/lib/server/notice-pdf";

export const runtime = "nodejs";

/**
 * Урьдчилан мэдэгдэх хуудсыг PDF болгож буцаана.
 *
 * ЯАГААД DOCX-ийг ХӨРВҮҮЛЭХГҮЙ ВЭ: docx→pdf хөрвүүлэлт LibreOffice/Word
 * шаарддаг ба энэ стекд (Node + Go alpine контейнер) байхгүй. Иймд ижил
 * загварын ТЕКСТ, ОРЛУУЛАХ ТАЛБАРУУДЫГ (medegdeh_huudas.docx) pdfmake-ээр
 * шууд PDF болгон үүсгэнэ — үг хэллэг нь docx-тэй адилхан.
 *
 * Кирилл: pdfmake-ийн Roboto нь Ө/ө/Ү/ү зэрэг монгол кирилл үсгийг агуулдаг
 * (шалгасан) тул нэмэлт фонт шаардахгүй.
 */
export async function POST(request: NextRequest) {
  try {
    // Энэ route DB руу шууд (au нэр) ханддаг тул Go backend-ийн эрхийн систем
    // хамгаалдаггүй — DOCX route-ийн адил нэвтэрсэн эсэхийг шалгана.
    if (!(await isAuthenticated(request.headers.get("authorization")))) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => ({}));
    const rawValues = body?.values && typeof body.values === "object" ? body.values : {};
    const values = await resolveAdminUnitNames(rawValues);
    const pdf = await buildNoticePdf(values);

    const parcelPart = String(values.parcel_id || "template").replace(/[\\/:*?"<>|]+/g, "_");
    const filename = `medegdeh_huudas_${parcelPart}.pdf`;

    return new Response(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF файл үүсгэхэд алдаа гарлаа";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
