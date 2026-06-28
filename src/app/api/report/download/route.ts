import { NextRequest } from "next/server";
import path from "path";
import { isExternalAuthorization } from "@/lib/server-auth";

export const runtime = "nodejs";

const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";

const RIGHT_TYPE_LABELS: Record<number, string> = {
  1: "Ашиглах",
  2: "Эзэмших",
  3: "Өмчлөх",
};

type AnyRow = any;

async function backendFetch(url: string, token: string) {
  const res = await fetch(`${BACKEND}${url}`, {
    headers: { Authorization: token },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend ${url} → ${res.status}`);
  return res.json();
}

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawToken = searchParams.get("token") ?? "";
  const token =
    request.headers.get("authorization") ??
    (rawToken
      ? rawToken.toLowerCase().startsWith("bearer ")
        ? rawToken
        : `Bearer ${rawToken}`
      : "");

  if (isExternalAuthorization(token)) {
    return new Response(JSON.stringify({ error: "Тайлан татах эрхгүй" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const planCode = searchParams.get("plan_code") ?? "";
  const acqId = searchParams.get("acquisition_id") ?? "";
  const acqName = searchParams.get("acquisition_name") ?? "";
  const years = searchParams.getAll("year").filter(Boolean);
  const au3Code = searchParams.get("au3_code") ?? "";
  const rightType = searchParams.get("right_type") ?? "";
  const landuse = searchParams.get("landuse") ?? "";
  const compType = searchParams.get("compensation_type") ?? "";

  const encoder = new TextEncoder();
  const stream = new TransformStream<string, Uint8Array>({
    transform(chunk, ctrl) {
      ctrl.enqueue(encoder.encode(chunk));
    },
  });
  const writer = stream.writable.getWriter();
  const write = (data: object) => writer.write(sse(data)).catch(() => {});

  (async () => {
    try {
      // ── 1. Backend-ийн /report/download endpoint-оос 200-аар давтан татах ────────
      const BATCH = 200;
      let allRows: AnyRow[] = [];

      const buildUrl = (page: number, yr?: string) => {
        const q = new URLSearchParams({
          page: String(page),
          page_size: String(BATCH),
        });
        if (planCode) q.set("plan_code", planCode);
        if (acqId) q.set("acquisition_id", acqId);
        if (acqName) q.set("acquisition_name", acqName);
        if (au3Code) q.set("au3_code", au3Code);
        if (rightType) q.set("right_type", rightType);
        if (landuse) q.set("landuse", landuse);
        if (yr) q.set("year", yr);
        if (compType) q.set("compensation_type", compType);
        return `/api/v1/report/download?${q.toString()}`;
      };

      // Он бүр тус тусад нь татаж нэгтгэнэ (backend нэг л он дэмждэг)
      const yearsToFetch = years.length > 0 ? years : [undefined];
      let totalItems = 0;

      for (const yr of yearsToFetch) {
        const firstRes = await backendFetch(buildUrl(1, yr), token);
        const totalPages = firstRes.total_pages ?? 1;
        totalItems += firstRes.total ?? firstRes.data?.length ?? 0;

        allRows = [...allRows, ...(firstRes.data ?? [])];
        await write({ type: "total", total: totalItems });
        await write({ type: "progress", current: allRows.length });

        for (let p = 2; p <= totalPages; p++) {
          const res = await backendFetch(buildUrl(p, yr), token);
          allRows = [...allRows, ...(res.data ?? [])];
          await write({ type: "progress", current: allRows.length });
        }
      }

      if (allRows.length === 0) {
        await write({ type: "done", base64: "", filename: "тайлан.xlsx" });
        await writer.close().catch(() => {});
        return;
      }

      // ── 2. Excel үүсгэх ─────────────────────────────────────────────────────
      await write({ type: "generating" });

      const ExcelJS = (await import("exceljs")).default;
      const templatePath = path.join(
        process.cwd(),
        "public",
        "templates",
        "report_template.xlsx",
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(templatePath);
      const ws = workbook.getWorksheet(1)!;

      const templateDataRow = ws.getRow(5);
      const savedStyles: AnyRow[] = [];
      for (let c = 1; c <= 19; c++) {
        savedStyles.push(
          JSON.parse(JSON.stringify(templateDataRow.getCell(c).style)),
        );
      }
      const savedRowHeight = templateDataRow.height ?? 18;
      const lastTemplateRow = ws.lastRow?.number ?? 5;

      // ── 3. Мөр бүр бичих ────────────────────────────────────────────────────
      for (let idx = 0; idx < allRows.length; idx++) {
        const r = allRows[idx];

        const holderFull = [
          [r.holder_last_name, r.holder_name].filter(Boolean).join(" "),
          r.holder_register_no,
        ]
          .filter(Boolean)
          .join(", ");

        const decreePart = [r.decree_date ?? "", r.decree_number ?? ""]
          .filter(Boolean)
          .join(" / ");

        const rowValues: (string | number | null)[] = [
          null,
          idx + 1,
          r.construction_type_name || "",
          r.acquisition_name || "",
          decreePart,
          holderFull,
          "",
          r.parcel_id ?? "",
          r.area_m2 ?? 0,
          RIGHT_TYPE_LABELS[r.right_type as number] ?? "",
          r.acquisition_area_m2 ?? 0,
          r.land_comp > 0 ? r.land_comp : null,
          r.real_state_comp > 0 ? r.real_state_comp : null,
          r.property_comp > 0 ? r.property_comp : null,
          r.total_comp > 0 ? r.total_comp : null,
          r.remaining_area_m2 > 0 ? r.remaining_area_m2 : null,
          r.db_changed ? "Тийм" : "Үгүй",
          r.changed_parcel_id || "",
          r.remaining_area_m2 > 0 ? r.remaining_area_m2 : null,
        ];

        const row = ws.getRow(5 + idx);
        row.height = savedRowHeight;
        for (let c = 1; c <= 19; c++) {
          const cell = row.getCell(c);
          cell.style = JSON.parse(JSON.stringify(savedStyles[c - 1]));
          cell.value = rowValues[c - 1] ?? null;
        }
        row.commit();
      }

      // Үлдсэн template мөрүүдийг цэвэрлэх
      for (let r = 5 + allRows.length; r <= lastTemplateRow; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= 19; c++) row.getCell(c).value = null;
        row.commit();
      }

      // ── 4. Буцаах ───────────────────────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer as ArrayBuffer).toString("base64");
      const filename = `тайлан_бүгд_${new Date().toISOString().slice(0, 10)}.xlsx`;

      await write({ type: "done", base64, filename });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await write({ type: "error", message: msg });
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(stream.readable as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
