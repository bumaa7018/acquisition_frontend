import { Pool } from "pg";

export type TemplateValues = Record<string, unknown>;

const pool = new Pool({
  host: process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "postgres" : "localhost"),
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "appdb",
  ssl: process.env.DB_SSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export async function resolveAdminUnitNames(values: TemplateValues): Promise<TemplateValues> {
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
