import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { fillPaymentPerformance } from "@/lib/server/payment-performance-xlsx";
import { isAuthenticated, unauthorizedResponse } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

const TEMPLATE = path.join(process.cwd(), "public", "templates", "tulbur_guitsegel.xlsx");

function safeFilePart(value: unknown): string {
  return String(value || "template").replace(/[\\/:*?"<>|]+/g, "_");
}

const amount = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/**
 * «Төлбөрийн гүйцэтгэл» — нийт үнэлгээг сонгосон шатаар (60% / 40% / 100%) хувьлан,
 * урьд авсан санхүүжилтийг нэгж талбарын олголтын гүйцэтгэлээс бодож бөглөнө.
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated(request.headers.get("authorization")))) {
      return unauthorizedResponse();
    }
    const body = await request.json().catch(() => ({}));
    const stage = Number(body?.stage);
    if (stage !== 60 && stage !== 40 && stage !== 100) {
      return Response.json({ error: "Гүйцэтгэлийн хувийг (60%, 40% эсвэл 100%) сонгоно уу" }, { status: 400 });
    }
    const output = await fillPaymentPerformance(await readFile(TEMPLATE), {
      stage,
      land: amount(body?.land),
      realEstate: amount(body?.realEstate),
      property: amount(body?.property),
      paid60: body?.paid60 === true,
      paid40: body?.paid40 === true,
      paidFull: body?.paidFull === true,
      acquisitionName: typeof body?.acquisitionName === "string" ? body.acquisitionName : undefined,
      period: typeof body?.period === "string" ? body.period : undefined,
      date: typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    });
    const filename = `tulbur_guitsegel_${stage}_${safeFilePart(body?.parcelId)}.xlsx`;
    const responseBody = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Excel файл үүсгэхэд алдаа гарлаа";
    return Response.json({ error: message }, { status: 500 });
  }
}
