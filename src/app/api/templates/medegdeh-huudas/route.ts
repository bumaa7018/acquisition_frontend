import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { renderDocxTemplate } from "@/lib/server/docx-template";
import { resolveAdminUnitNames } from "@/lib/server/admin-units";
import { isAuthenticated, unauthorizedResponse } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

function safeFilePart(value: unknown): string {
  return String(value || "template").replace(/[\\/:*?"<>|]+/g, "_");
}

const ALLOWED_TEMPLATES = new Set([
  "medegdeh_huudas.docx",
  "sanal_asuulgiin_huudas.docx",
  "niigem_ediin_zasag_sudalgaa.docx",
  "shalgah_huudas.docx",
  "hurliin_temdeglel.docx",
  "uulzaltiin_temdeglel.docx",
  "gazar_huleelcsen_akt.docx",
  "gazar_huleelcsen_akt-2.docx",
  "hynalt_card.docx",
]);

function resolveTemplatePath(filename: unknown): { filename: string; fullPath: string } {
  const requested = typeof filename === "string" ? filename : "medegdeh_huudas.docx";
  const safeName = path.basename(requested);
  if (!safeName.endsWith(".docx")) throw new Error("Зөвхөн docx загвар дэмжинэ");
  if (!ALLOWED_TEMPLATES.has(safeName)) throw new Error("Загварын файл зөвшөөрөгдөөгүй байна");

  const templatesDir = path.join(process.cwd(), "public", "templates");
  const fullPath = path.join(templatesDir, safeName);
  if (!fullPath.startsWith(templatesDir + path.sep)) {
    throw new Error("Загварын файлын нэр буруу байна");
  }

  return { filename: safeName, fullPath };
}

export async function POST(request: NextRequest) {
  try {
    // Энэ route DB руу шууд (au нэр) хандаж баримт үүсгэдэг тул Go backend-ийн
    // эрхийн систем хамгаалдаггүй — эндээс нэвтэрсэн хэрэглэгчийн л хүсэлтийг үргэлжлүүлнэ.
    if (!(await isAuthenticated(request.headers.get("authorization")))) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => ({}));
    const rawValues = body?.values && typeof body.values === "object" ? body.values : {};
    const values = await resolveAdminUnitNames(rawValues);
    const { filename: templateFilename, fullPath } = resolveTemplatePath(body?.filename);
    const template = await readFile(fullPath);
    const output = renderDocxTemplate(Buffer.from(template), values);
    const responseBody = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    const filename = `${templateFilename.replace(/\.docx$/i, "")}_${safeFilePart(values.parcel_id)}.docx`;

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DOCX файл үүсгэхэд алдаа гарлаа";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
