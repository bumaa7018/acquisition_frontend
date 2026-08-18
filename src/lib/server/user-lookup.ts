import { Pool } from "pg";

// Нөхөх олговрыг зөвшөөрсөн санхүүгийн мэргэжилтний нэрийг гэрээнд бичихэд
// ашиглана. compensation.reviewed_by нь нэвтрэлтийн ID-г ТЕКСТ хэлбэрээр
// хадгалдаг тул admin-units.ts-ийн адил тусдаа (auth) сан руу шууд холбогдоно.
//
// sdplatform шилжилтийн дараа энэ лавлагаа өөрчлөгдсөн:
//   * public.users хүснэгт УСТСАН (migrations/auth/000014) — sdplatform.sd_user
//     руу шилжсэн;
//   * ID нь uuid-аас int4 болсон тул "$1::uuid" cast нь алдаа өгдөг байв.
// Эдгээрийн улмаас гэрээний DOCX дээр мэргэжилтний нэр хоосон хэвлэгддэг байлаа.
const pool = new Pool({
  host: process.env.AUTH_DB_HOST || process.env.DB_HOST || (process.env.NODE_ENV === "production" ? "postgres" : "localhost"),
  port: Number(process.env.AUTH_DB_PORT || process.env.DB_PORT || 5432),
  user: process.env.AUTH_DB_USER || process.env.DB_USER || "postgres",
  password: process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD || "postgres",
  database: process.env.AUTH_DB_NAME || "authdb",
  ssl: process.env.DB_SSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

function firstLetter(value?: string | null): string {
  return value?.trim().charAt(0) || "";
}

export async function resolveUserName(userId: string | undefined | null): Promise<{
  firstName: string;
  lastNameFirstSpell: string;
} | null> {
  if (!userId) return null;

  // sd_user.user_id нь int4 — тоо биш утга ирвэл лавлагаа хийх шаардлагагүй
  // (буруу cast хийвэл SQL алдаа өгнө).
  const numericId = Number(String(userId).trim());
  if (!Number.isInteger(numericId)) return null;

  try {
    const res = await pool.query<{ first_name: string | null; last_name: string | null }>(
      `SELECT COALESCE(u.firstname, '') AS first_name,
              COALESCE(u.lastname, '')  AS last_name
       FROM sdplatform.sd_user u
       WHERE u.user_id = $1::int4 AND u.deleted_at IS NULL`,
      [numericId],
    );
    const row = res.rows[0];
    if (!row) return null;

    return {
      firstName: row.first_name || "",
      lastNameFirstSpell: firstLetter(row.last_name),
    };
  } catch (err) {
    console.error("[docx-template] failed to resolve user name", err);
    return null;
  }
}
