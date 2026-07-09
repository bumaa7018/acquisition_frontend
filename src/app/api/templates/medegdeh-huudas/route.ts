import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { renderDocxTemplate } from "@/lib/server/docx-template";

export const runtime = "nodejs";

type TemplateValues = Record<string, unknown>;

const pool = new Pool({
  host: process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "postgres" : "localhost"),
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "appdb",
  ssl: process.env.DB_SSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

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

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

async function resolveAdminUnitNames(values: TemplateValues): Promise<TemplateValues> {
  const au1Code = stringValue(values.au1_code);
  const au2Code = stringValue(values.au2_code);
  const au3Code = stringValue(values.au3_code);

  if (!au1Code && !au2Code && !au3Code) return values;

  try {
    const res = await pool.query<{
      au1_name: string | null;
      au2_name: string | null;
      au3_name: string | null;
    }>(
      `
      SELECT
        a1.name AS au1_name,
        a2.name AS au2_name,
        a3.name AS au3_name
      FROM (SELECT $1::text AS au1_code, $2::text AS au2_code, $3::text AS au3_code) c
      LEFT JOIN au1 a1 ON a1.code = c.au1_code
      LEFT JOIN au2 a2 ON a2.code = c.au2_code
      LEFT JOIN au3 a3 ON a3.code = c.au3_code
      `,
      [au1Code, au2Code, au3Code],
    );

    const row = res.rows[0];
    if (!row) return values;

    const nextValues = { ...values };
    if (row.au1_name) nextValues.au1_name = row.au1_name;
    if (row.au2_name) nextValues.au2_name = row.au2_name;
    if (row.au3_name) nextValues.au3_name = row.au3_name;

    const address = [nextValues.au1_name, nextValues.au2_name, nextValues.au3_name]
      .map(stringValue)
      .filter(Boolean)
      .join(" ");
    if (address) {
      nextValues.address = address;
      nextValues["хаяг"] = address;
    }

    return nextValues;
  } catch (err) {
    console.error("[docx-template] failed to resolve administrative unit names", err);
    return values;
  }
}

export async function POST(request: NextRequest) {
  try {
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
