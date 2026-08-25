import { readFile } from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { renderDocxTemplate } from "@/lib/server/docx-template";
import {
  formatNumber,
  injectDecisionDraftCompensationRows,
  type DecisionDraftDocxGroup,
  type DecisionDraftDocxTableRow,
} from "@/lib/server/decision-draft-docx-table";
import { isAuthenticated, unauthorizedResponse } from "@/lib/server/verify-auth";
import { numberToMongolianWords } from "@/lib/mongolian-number";

export const runtime = "nodejs";

const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";
const TEMPLATE_FILENAME = "decision_draft.docx";

type ApiResponse<T> = { data?: T };
type PaginatedResponse<T> = { data: T[]; total?: number };

type DecisionDraft = {
  id: string;
  proposal_no: string;
  decree_number?: string;
};

type DecisionDraftParcel = {
  id: string;
  parcel_uuid: string;
  removed_at?: string;
  parcel_id: string;
  acquisition_id: string;
  acquisition_name: string;
  area_m2: number;
  acquisition_area_m2: number;
  compensation_amount: number;
  landuse: string;
};

type AU = {
  au1_name?: string;
  au2_name?: string;
  au3_name?: string;
};

type LandAcquisition = {
  id: string;
  acquisition_name: string;
  general_category_name?: string;
  sub_category_name?: string;
  aus?: AU[];
};

type ParcelFull = {
  parcel_id: string;
  right_type?: number;
  landuse?: string;
  area_m2?: number;
  acquisition_area_m2?: number;
  selected_valuation_type?: "asset" | "independent" | "mika" | null;
  detail?: {
    holder_last_name?: string;
    holder_name?: string;
    holder_register_no?: string;
    certificate_no?: string;
  };
};

type LandValuation = {
  land_area_m2?: number;
  total_value?: number;
  ownership_cert_no?: string;
};

type Asset = {
  id: string;
  asset_type: "real_state" | "property";
};

type Compensation = {
  target_type: "parcel" | "asset";
  asset_id?: string;
  amount: number;
};

const RIGHT_TYPE_LABELS: Record<number, string> = {
  1: "ашиглах",
  2: "эзэмших",
  3: "өмчлөх",
};

function safeFilePart(value: unknown): string {
  return String(value || "decision_draft").replace(/[\\/:*?"<>|]+/g, "_");
}

async function backendRaw<T>(authorization: string, url: string): Promise<T> {
  const res = await fetch(`${BACKEND}/api/v1${url}`, {
    headers: { Authorization: authorization, "Accept-Language": "mn" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Backend request failed: ${url}`);
  }
  return (await res.json()) as T;
}

async function backendData<T>(authorization: string, url: string): Promise<T> {
  const body = await backendRaw<ApiResponse<T>>(authorization, url);
  if (Object.prototype.hasOwnProperty.call(body, "data")) return body.data as T;
  return body as T;
}

function joinUnique(values: Array<string | undefined | null>): string {
  const list = Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
  return list.join(", ");
}

function formatDatePart(part: "year" | "month" | "day") {
  const now = new Date();
  if (part === "year") return String(now.getFullYear());
  if (part === "month") return String(now.getMonth() + 1).padStart(2, "0");
  return String(now.getDate()).padStart(2, "0");
}

function money(value: number, fraction = 0): string {
  return formatNumber(value, fraction);
}

// Загварт "{...amount} ({...amount_text}) төгрөгийг" гэж бичигдсэн тул "төгрөг"-ийг
// давхардуулж нэмэхгүй — зөвхөн дүнг үгээр бичнэ.
function moneyText(value: number): string {
  return numberToMongolianWords(Math.round(Number(value) || 0));
}

function countText(value: number): string {
  return numberToMongolianWords(Math.trunc(Number(value) || 0));
}

function compensationSum(comps: Compensation[], predicate: (item: Compensation) => boolean): number {
  return comps.filter(predicate).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function groupTitle(acquisition: LandAcquisition): string {
  const au2 = joinUnique(acquisition.aus?.map((a) => a.au2_name) ?? []);
  const au3 = joinUnique(acquisition.aus?.map((a) => a.au3_name) ?? []);
  const category = acquisition.sub_category_name || acquisition.general_category_name || "";
  return `${au2} дүүргийн ${au3} нутаг дэвсгэрт баригдах ${category} дахин төлөвлөлт`
    .replace(/\s+/g, " ")
    .trim();
}

async function parcelRow(
  authorization: string,
  index: number,
  draftParcel: DecisionDraftParcel,
  acquisition: LandAcquisition,
): Promise<{ row: DecisionDraftDocxTableRow; total: number }> {
  const parcel = await backendData<ParcelFull>(
    authorization,
    `/land-acquisitions/${encodeURIComponent(draftParcel.acquisition_id)}/parcels/${encodeURIComponent(draftParcel.parcel_uuid)}`,
  );
  const valuationType = parcel.selected_valuation_type || "asset";
  const query = `parcel_id=${encodeURIComponent(draftParcel.parcel_id)}&valuation_type=${encodeURIComponent(valuationType)}`;
  const [landValuation, assetsResult, compensations] = await Promise.all([
    backendData<LandValuation | null>(
      authorization,
      `/land-acquisitions/${encodeURIComponent(draftParcel.acquisition_id)}/land-valuation?${query}`,
    ),
    backendRaw<PaginatedResponse<Asset>>(
      authorization,
      `/land-acquisitions/${encodeURIComponent(draftParcel.acquisition_id)}/assets?page=1&page_size=1000&${query}`,
    ),
    backendData<Compensation[]>(
      authorization,
      `/land-acquisitions/${encodeURIComponent(draftParcel.acquisition_id)}/compensations?${query}`,
    ),
  ]);

  const assets = assetsResult.data ?? [];
  const realEstateIds = new Set(assets.filter((asset) => asset.asset_type === "real_state").map((asset) => asset.id));
  const propertyIds = new Set(assets.filter((asset) => asset.asset_type === "property").map((asset) => asset.id));
  const landComp = compensationSum(compensations, (item) => item.target_type === "parcel");
  const realEstateComp = compensationSum(
    compensations,
    (item) => item.target_type === "asset" && !!item.asset_id && realEstateIds.has(item.asset_id),
  );
  const propertyComp = compensationSum(
    compensations,
    (item) => item.target_type === "asset" && !!item.asset_id && propertyIds.has(item.asset_id),
  );
  const landAmount = landComp || Number(landValuation?.total_value) || 0;
  const total = landAmount + realEstateComp + propertyComp || Number(draftParcel.compensation_amount) || 0;
  const detail = parcel.detail;
  const holder = [detail?.holder_last_name, detail?.holder_name, detail?.holder_register_no].filter(Boolean).join(" ");
  const address = joinUnique([
    ...((acquisition.aus ?? []).map((a) => [a.au1_name, a.au2_name, a.au3_name].filter(Boolean).join(" ")) ?? []),
  ]);

  return {
    total,
    row: {
      no: String(index),
      holder: holder || "-",
      address: address || "-",
      parcelId: parcel.parcel_id || draftParcel.parcel_id,
      areaM2: money(Number(parcel.area_m2 ?? draftParcel.area_m2), 2),
      rightType: RIGHT_TYPE_LABELS[parcel.right_type || 0] || draftParcel.landuse || "-",
      landCertificateNo: landValuation?.ownership_cert_no || detail?.certificate_no || "-",
      affectedAreaM2: money(Number(landValuation?.land_area_m2 ?? parcel.acquisition_area_m2 ?? draftParcel.acquisition_area_m2), 2),
      landCompensation: money(landAmount),
      assetCertificateNo: "-",
      realEstateCompensation: money(realEstateComp),
      propertyCompensation: money(propertyComp),
      totalCompensation: money(total),
    },
  };
}

async function acquisitionParcelTotal(authorization: string, acquisitionId: string, fallback: number): Promise<number> {
  try {
    const result = await backendRaw<PaginatedResponse<unknown>>(
      authorization,
      `/land-acquisitions/${encodeURIComponent(acquisitionId)}/parcels?page=1&page_size=1`,
    );
    return Number(result.total) || fallback;
  } catch {
    return fallback;
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authorization = _request.headers.get("authorization");
    if (!(await isAuthenticated(authorization))) return unauthorizedResponse();
    if (!authorization) return unauthorizedResponse();

    const draftId = params.id;
    const [draft, draftParcels] = await Promise.all([
      backendData<DecisionDraft>(authorization, `/decision-drafts/${encodeURIComponent(draftId)}`),
      backendData<DecisionDraftParcel[]>(authorization, `/decision-drafts/${encodeURIComponent(draftId)}/parcels`),
    ]);

    const activeParcels = draftParcels.filter((parcel) => !parcel.removed_at);
    const acquisitionIds = Array.from(new Set(activeParcels.map((parcel) => parcel.acquisition_id).filter(Boolean)));
    const acquisitions = new Map<string, LandAcquisition>();
    await Promise.all(
      acquisitionIds.map(async (id) => {
        acquisitions.set(id, await backendData<LandAcquisition>(authorization, `/land-acquisitions/${encodeURIComponent(id)}`));
      }),
    );

    let index = 1;
    let decisionAmount = 0;
    const groups: DecisionDraftDocxGroup[] = [];
    for (const acquisitionId of acquisitionIds) {
      const acquisition = acquisitions.get(acquisitionId);
      if (!acquisition) continue;
      const rows = await Promise.all(
        activeParcels
          .filter((parcel) => parcel.acquisition_id === acquisitionId)
          .map(async (parcel) => {
            const rowIndex = index;
            index += 1;
            const result = await parcelRow(authorization, rowIndex, parcel, acquisition);
            decisionAmount += result.total;
            return result.row;
          }),
      );
      groups.push({ title: groupTitle(acquisition), rows });
    }

    const totalParcelCount = (
      await Promise.all(
        acquisitionIds.map((id) =>
          acquisitionParcelTotal(
            authorization,
            id,
            activeParcels.filter((parcel) => parcel.acquisition_id === id).length,
          ),
        ),
      )
    ).reduce((sum, count) => sum + count, 0);

    const acquisitionsList = Array.from(acquisitions.values());
    const values = {
      decision_draft_no: draft.proposal_no || draft.decree_number || "",
      year: formatDatePart("year"),
      month: formatDatePart("month"),
      day: formatDatePart("day"),
      acquisition_name: joinUnique(acquisitionsList.map((a) => a.acquisition_name)),
      acquisitioin_name: joinUnique(acquisitionsList.map((a) => a.acquisition_name)),
      acqiusition_name: joinUnique(acquisitionsList.map((a) => a.acquisition_name)),
      acquisition_au1_name: joinUnique(acquisitionsList.flatMap((a) => a.aus?.map((au) => au.au1_name) ?? [])),
      acquisition_au2_name: joinUnique(acquisitionsList.flatMap((a) => a.aus?.map((au) => au.au2_name) ?? [])),
      acquisition_au3_name: joinUnique(acquisitionsList.flatMap((a) => a.aus?.map((au) => au.au3_name) ?? [])),
      acquisitioin_category_name: joinUnique(
        acquisitionsList.map((a) => a.sub_category_name || a.general_category_name),
      ),
      acquisition_total_parcel: String(totalParcelCount),
      acquisition_total_parcel_by_text: countText(totalParcelCount),
      acquisition_decision_parcel: String(activeParcels.length),
      acquisitioin_decision_parcel: String(activeParcels.length),
      acquisition_decision_parcel_by_text: countText(activeParcels.length),
      acquisition_decision_parcel_amount: money(decisionAmount),
      acquisitioin_decision_parcel_amount: money(decisionAmount),
      acquisition_decision_parcel_amount_by_text: moneyText(decisionAmount),
      acquisitioin_decision_parcel_amount_text: moneyText(decisionAmount),
    };

    const templatePath = path.join(process.cwd(), "public", "templates", TEMPLATE_FILENAME);
    const template = await readFile(templatePath);
    const withRows = await injectDecisionDraftCompensationRows(Buffer.from(template), groups);
    const output = await renderDocxTemplate(withRows, values);
    const responseBody = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
    const filename = `decision_draft_${safeFilePart(draft.proposal_no || draftId)}.docx`;
    const asciiFilename = `decision_draft_${safeFilePart(draftId)}.docx`;

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Захирамжийн төсөл DOCX үүсгэхэд алдаа гарлаа";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
