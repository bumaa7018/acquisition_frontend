import { Pool } from "pg";

// Нөхөх олговрыг зөвшөөрсөн санхүүгийн мэргэжилтний нэрийг гэрээнд бичихэд ашиглана.
// compensation.reviewed_by нь authdb.users-ийн ID тул admin-units.ts-ийн адил
// зориулалттай, тусдаа (auth) өгөгдлийн сан руу шууд холбогдоно.
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

  try {
    const res = await pool.query<{ first_name: string | null; last_name: string | null }>(
      "SELECT first_name, last_name FROM users WHERE id = $1::uuid AND deleted_at IS NULL",
      [userId],
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
