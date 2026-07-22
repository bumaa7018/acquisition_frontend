import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { readZipEntries, renderDocxTemplate } from "@/lib/server/docx-template";
import { mergeDocx } from "@/lib/server/docx-merge";
import { resolveAdminUnitNames } from "@/lib/server/admin-units";
import { injectPropertyRows, type PropertyRow } from "@/lib/server/docx-table-rows";
import { resolveUserName } from "@/lib/server/user-lookup";
import { isAuthenticated, unauthorizedResponse } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

const TEMPLATE_FILENAME = "acquisition_contract.docx";
// Go backend-ийн parcel document upload-той ижил дээд хэмжээ (upload_validation.go
// maxDocumentUploadSize) — гар аргаар шууд route руу хавсаргасан асар том файлаас хамгаална.
const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

function safeFilePart(value: unknown): string {
  return String(value || "gereee").replace(/[\\/:*?"<>|]+/g, "_");
}

function stringField(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function parsePropertyRows(raw: unknown): PropertyRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      name: stringField(item.name),
      certificateNo: stringField(item.certificateNo),
      area: stringField(item.area),
      amount: stringField(item.amount),
    }));
}

// Хавсралтын жинхэнэ агуулгаар нь (файлын нэрээр биш) DOCX мөн эсэхийг шалгана —
// хавсаргасан баримтын дэлгэцийн нэр (Document.name) ихэвчлэн өргөтгөлгүй байдаг тул
// файлын нэрэнд тулгуурлах шалгалт үнэн зөв DOCX-ийг ч буруу татгалздаг байсан.
function isDocxBuffer(data: Buffer): boolean {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b || data[2] !== 0x03 || data[3] !== 0x04) {
    return false;
  }
  try {
    const entries = readZipEntries(data);
    return entries.some((e) => e.name === "word/document.xml");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Энэ route DB руу шууд (au нэр, ажилтны нэр) хандаж баримт үүсгэдэг тул
    // Go backend-ийн эрхийн систем хамгаалдаггүй — эндээс АНХ ШАЛГАЖ нэвтэрсэн
    // хэрэглэгчийн л хүсэлтийг үргэлжлүүлнэ (/report/download route-ын адил загвар).
    if (!(await isAuthenticated(request.headers.get("authorization")))) {
      return unauthorizedResponse();
    }

    const form = await request.formData();

    const rawValues = form.get("values");
    let values: Record<string, unknown> = {};
    if (typeof rawValues === "string") {
      try {
        const parsed = JSON.parse(rawValues);
        if (parsed && typeof parsed === "object") values = parsed;
      } catch {
        // хоосон утгаар үргэлжилнэ
      }
    }
    values = await resolveAdminUnitNames(values);

    const approver = await resolveUserName(stringField(values.compensation_approved_emp_user_id));
    if (approver) {
      values = {
        ...values,
        compensation_approved_emp_firstname: approver.firstName,
        compensation_approved_emp_lastname_first_spell: approver.lastNameFirstSpell,
      };
    }

    let propertyRowsRaw: unknown = [];
    const rawPropertyRows = form.get("property_rows");
    if (typeof rawPropertyRows === "string") {
      try {
        propertyRowsRaw = JSON.parse(rawPropertyRows);
      } catch {
        // хоосон жагсаалтаар үргэлжилнэ
      }
    }
    const propertyRows = parsePropertyRows(propertyRowsRaw);

    const attachment = form.get("attachment");
    if (!(attachment instanceof File)) {
      return new Response(
        JSON.stringify({ error: "Хурлын тэмдэглэл (docx) хавсралт заавал шаардлагатай" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (attachment.size > MAX_ATTACHMENT_SIZE) {
      return new Response(JSON.stringify({ error: "Хавсралт хэт том байна (50MB хүртэл)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const attachmentBuffer = Buffer.from(await attachment.arrayBuffer());
    if (!isDocxBuffer(attachmentBuffer)) {
      return new Response(
        JSON.stringify({ error: "Хурлын тэмдэглэлийн хавсралт зөв DOCX файл биш байна" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const templatesDir = path.join(process.cwd(), "public", "templates");
    const templatePath = path.join(templatesDir, TEMPLATE_FILENAME);
    const template = await readFile(templatePath);
    const templateWithRows = injectPropertyRows(Buffer.from(template), propertyRows);
    const rendered = renderDocxTemplate(templateWithRows, values);

    const merged = mergeDocx(rendered, attachmentBuffer);
    const responseBody = merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength) as ArrayBuffer;
    const filename = `gereee_${safeFilePart(values.parcel_id)}.docx`;

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Гэрээ үүсгэхэд алдаа гарлаа";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
