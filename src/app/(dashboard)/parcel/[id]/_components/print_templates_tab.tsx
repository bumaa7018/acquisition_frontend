"use client";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { landApi, parcelApi, documentTypeApi } from "@/lib/api";
import { authStorage } from "@/lib/auth";
// Загварын орлуулах утгууд нь "Эзэмшигч" табын мэдэгдэх хуудастай ХУВААЛЦАГДАНА
import {
  authHeaders,
  buildDocxTemplateValues,
  firstLetter,
  formatMoney,
  formatTemplateDate,
  getAssignedEmployee,
} from "@/lib/template-values";
import { formatArea } from "@/lib/utils";
import type { Asset, Compensation, Document, LandAcquisition, LandValuation, ParcelFull } from "@/types";
import { RIGHT_TYPE_LABELS } from "@/types";
import { amountToMongolianWords } from "@/lib/mongolian-number";

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MEETING_MINUTES_DOC_TYPE = "meeting_minutes";

interface PrintTemplate {
  id: string;
  name: string;
  description: string;
  filename: string;
  isDynamic?: boolean;
  isExcel?: boolean;
  // Статик файлыг (docx г.м) шууд татна — нээж PDF хадгалах шаардлагагүй
  isDownload?: boolean;
  // Загварыг өөрчлөхгүйгээр байгаагаар нь шууд татна (жишээ нь бэлэн xlsx)
  isStaticFile?: boolean;
  // Хэвлэхийн өмнө "Хурлын тэмдэглэл" (docx) хавсралт шаардаж, түүнийг гэрээний ард нэгтгэнэ
  requiresMeetingMinutes?: boolean;
}

function buildUrl(tpl: PrintTemplate, parcel?: ParcelFull): string {
  if (!tpl.isDynamic) return `/templates/${tpl.filename}`;

  const params = new URLSearchParams();
  if (parcel?.detail?.holder_last_name || parcel?.detail?.holder_name) {
    params.set(
      "holder_name",
      [parcel.detail.holder_last_name, parcel.detail.holder_name]
        .filter(Boolean)
        .join(" ")
    );
  }
  if (parcel?.parcel_id) params.set("parcel_id", parcel.parcel_id);
  if (parcel?.detail?.holder_phone) params.set("phone", parcel.detail.holder_phone);
  const qs = params.toString();
  return `/templates/${tpl.filename}${qs ? "?" + qs : ""}`;
}

function openTemplate(tpl: PrintTemplate, parcel?: ParcelFull) {
  const url = buildUrl(tpl, parcel);
  const win = window.open(url, "_blank", "width=980,height=1150,menubar=no,toolbar=no");
  if (!win) toast.error("Попап цонх блоклогдсон байна. Браузерын тохиргооноос зөвшөөрнө үү.");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sumAmount(list: { amount: number }[]): number {
  return list.reduce((sum, c) => sum + (c.amount || 0), 0);
}

/**
 * Үндсэн эзэмшигч ХУУЛИЙН ЭТГЭЭД (байгууллага) эсэхийг тодорхойлно.
 *
 * Дүрэм (holder_tab.tsx-ийн `holderFullName`-тай ижил): хуулийн этгээд үед
 * `last_name` хоосон, нэр нь бүтнээрээ `name`/`holder_name`-д ордог.
 * `person_type` талбарт ("3: Монгол улсын хуулийн этгээд" мэт) шууд тэмдэглэгээ
 * ирвэл түүнийг давуу эрхээр авна.
 *
 * Үүнээс хамаарч "Урьдчилан мэдэгдэх хуудас"-ын иргэн/байгууллагын аль
 * хувилбарыг харуулахыг шийднэ.
 */
function isLegalEntityHolder(parcel?: ParcelFull): boolean {
  const holders = (parcel?.holders ?? []).filter((h) => h.holder_role !== "representative");
  const main = holders.find((h) => h.main_applicant) ?? holders[0];
  if (main) {
    if (/хуулийн этгээд|legal/i.test(main.person_type || "")) return true;
    return !main.last_name?.trim() && !!main.name?.trim();
  }
  const d = parcel?.detail;
  return !!d && !d.holder_last_name?.trim() && !!d.holder_name?.trim();
}

// Гэрээний хүснэгтийг (Газар/Барилга байгууламж/Эд хөрөнгө бусад/Нийт) системд
// бүртгэгдсэн хөрөнгө (Asset) болон баталгаажсан нөхөх олговрын (Compensation)
// мэдээллээр бөглөнө — сонгогдсон үнэлгээний урсгалаар (parcel.selected_valuation_type) шүүнэ.
// "Үл хөдлөх"-ийн хүснэгтийн мөрүүдийг (нэг хөрөнгө = нэг мөр) сервер рүү тусад нь
// (propertyRows) дамжуулж, docx-ийн хүснэгтэд шинэ мөр болгон нэмүүлнэ.
function buildAcquisitionContractValues(
  parcel: ParcelFull | undefined,
  acquisition: LandAcquisition | undefined,
  assets: Asset[],
  compensations: Compensation[],
  landValuation: LandValuation | null | undefined,
) {
  const base = buildDocxTemplateValues(parcel, acquisition);
  const rightType = parcel ? RIGHT_TYPE_LABELS[parcel.right_type] || "" : "";

  const realEstateAssets = assets.filter((a) => a.asset_type === "real_state");
  const propertyAssets = assets.filter((a) => a.asset_type === "property");
  const realEstateIds = new Set(realEstateAssets.map((a) => a.id));
  const propertyIds = new Set(propertyAssets.map((a) => a.id));

  const approved = compensations.filter((c) => c.status === "approved");
  const approvedByAsset = new Map<string, Compensation[]>();
  for (const c of approved) {
    if (c.target_type !== "asset" || !c.asset_id) continue;
    const list = approvedByAsset.get(c.asset_id) ?? [];
    list.push(c);
    approvedByAsset.set(c.asset_id, list);
  }

  const landCompTotal = sumAmount(approved.filter((c) => c.target_type === "parcel"));
  const realEstateCompTotal = sumAmount(
    approved.filter((c) => c.target_type === "asset" && c.asset_id && realEstateIds.has(c.asset_id)),
  );
  const propertyCompTotal = sumAmount(
    approved.filter((c) => c.target_type === "asset" && c.asset_id && propertyIds.has(c.asset_id)),
  );
  const totalCompensation = landCompTotal + realEstateCompTotal + propertyCompTotal;

  const propertyNames = realEstateAssets.map((a) => a.asset_name).filter(Boolean).join(", ");
  const propertyCertNos = realEstateAssets.map((a) => a.asset_number).filter(Boolean).join(", ");
  const propertyAreaTotal = realEstateAssets.reduce((sum, a) => sum + (a.area_m2 || 0), 0);

  const propertyRows = realEstateAssets.map((a) => ({
    name: a.asset_name || "-",
    certificateNo: a.asset_number || "",
    area: formatArea(a.area_m2),
    amount: formatMoney(sumAmount(approvedByAsset.get(a.id) ?? [])),
  }));

  // Бүх урсгал нэг зэрэг зөвшөөрөгддөг тул (parcel_valuation_submission) аль ч
  // баталгаажсан олговрын reviewed_by ижил хүн байх ёстой.
  const approverUserId = approved.find((c) => c.reviewed_by)?.reviewed_by || "";

  const values = {
    ...base,
    parcel_no: parcel?.parcel_id || "",
    parcel_right_type: rightType,
    parcel_certificate_no: parcel?.detail?.certificate_no || "",
    parcel_streetname: "",
    streetname: "",
    parcel_door_number: "",
    land_purpose_name: parcel?.landuse || "",
    parcel_compensation_amount: formatMoney(landCompTotal),

    all_property_names: propertyNames || "-",
    property_count: String(realEstateAssets.length),
    // Хүснэгтийн мөрүүд доор propertyRows-оор шинэ мөр болгон нэмэгддэг тул эдгээр нь
    // зөвхөн загварын бүтэц өөрчлөгдсөн үед (мөр нэмэгдэхгүй бол) нөөц утга байна.
    property_names: propertyNames || "-",
    property_certificate_no: propertyCertNos,
    property_area_m2: formatArea(propertyAreaTotal),
    property_compensation_amount: formatMoney(realEstateCompTotal),

    assets_compensation_amount_total: formatMoney(propertyCompTotal),

    compensation_amoint_total: formatMoney(totalCompensation),
    compensation_amoint_total_by_word: amountToMongolianWords(totalCompensation),

    profesional_company_name: landValuation?.appraiser_org_name || "",
    profesional_company_emp_fullname: landValuation?.appraiser_director || "",
    compensation_approved_emp_firstname: "",
    compensation_approved_emp_lastname_first_spell: "",
    compensation_approved_emp_user_id: approverUserId,
  };

  return { values, propertyRows };
}

function findMeetingMinutesDocxAttachment(
  docs: Document[],
  docTypes: { id: number; type: string }[],
): Document | undefined {
  const docType = docTypes.find((t) => t.type === MEETING_MINUTES_DOC_TYPE);
  if (!docType) return undefined;
  return docs.find(
    (d) =>
      d.document_type_id === docType.id &&
      (d.file_type === DOCX_CONTENT_TYPE || d.file_url.toLowerCase().endsWith(".docx")),
  );
}

async function downloadAcquisitionContract(params: {
  template: string;
  parcel?: ParcelFull;
  acquisition?: LandAcquisition;
  assets: Asset[];
  compensations: Compensation[];
  landValuation?: LandValuation | null;
  attachment?: Document;
}) {
  const { template, parcel, acquisition, assets, compensations, landValuation, attachment } = params;
  if (parcel?.acquisition_id && !acquisition) {
    throw new Error("Чөлөөлөлтийн мэдээлэл ачаалж байна. Түр хүлээгээд дахин татна уу.");
  }
  if (!attachment) {
    throw new Error(
      "Эхлээд \"Баримт бичиг\" табаас \"Хурлын тэмдэглэл\" (DOCX) хавсралт хавсаргана уу — Гэрээг зөвхөн энэ хавсралттай хамт хэвлэнэ.",
    );
  }

  const attachmentRes = await fetch(attachment.file_url);
  if (!attachmentRes.ok) throw new Error("Хурлын тэмдэглэлийн хавсралтыг татаж чадсангүй");
  const attachmentBlob = await attachmentRes.blob();

  const { values, propertyRows } = buildAcquisitionContractValues(parcel, acquisition, assets, compensations, landValuation);
  const fd = new FormData();
  fd.append("template", template);
  fd.append("values", JSON.stringify(values));
  fd.append("property_rows", JSON.stringify(propertyRows));
  // attachment.name бол дэлгэцийн нэр (өргөтгөлгүй байж болно) — жинхэнэ файлын
  // нэрийг file_url-ээс авна.
  const storedFilename = decodeURIComponent(attachment.file_url.split("/").pop() || "");
  fd.append("attachment", attachmentBlob, storedFilename || "hurliin_temdeglel.docx");

  const res = await fetch("/api/templates/acquisition-contract", { method: "POST", headers: authHeaders(), body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Гэрээ үүсгэхэд алдаа гарлаа");
  }
  const blob = await res.blob();
  triggerDownload(blob, `${template.replace(/\.docx$/i, "")}_${parcel?.parcel_id || "template"}.docx`);
}

// Статик файлыг (docx) шууд татна
function downloadFile(tpl: PrintTemplate) {
  const a = document.createElement("a");
  a.href = `/templates/${tpl.filename}`;
  a.download = tpl.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadDocxTemplate(tpl: PrintTemplate, parcel?: ParcelFull, acquisition?: LandAcquisition) {
  if (parcel?.acquisition_id && !acquisition) {
    throw new Error("Чөлөөлөлтийн мэдээлэл ачаалж байна. Түр хүлээгээд дахин татна уу.");
  }

  const res = await fetch("/api/templates/medegdeh-huudas", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      filename: tpl.filename,
      values: buildDocxTemplateValues(parcel, acquisition),
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "DOCX файл үүсгэхэд алдаа гарлаа");
  }

  const blob = await res.blob();
  triggerDownload(blob, `${tpl.filename.replace(/\.docx$/i, "")}_${parcel?.parcel_id || "template"}.docx`);
}

async function downloadDecisionDraft(parcel?: ParcelFull, acquisitionName?: string) {
  const res = await fetch("/templates/decition_draft.xlsx");
  const buffer = await res.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const setCell = (addr: string, val: unknown) => {
    ws[addr] = { v: val, t: typeof val === "number" ? "n" : "s" };
  };

  const holderName = [parcel?.detail?.holder_last_name, parcel?.detail?.holder_name]
    .filter(Boolean)
    .join(" ");
  const regNo = parcel?.detail?.holder_register_no || "";
  const fullName = regNo ? `${holderName} /${regNo}/` : holderName;
  const address = [parcel?.au1_code, parcel?.au2_code, parcel?.au3_code]
    .filter(Boolean)
    .join(" ");
  const rightLabel = parcel ? (RIGHT_TYPE_LABELS[parcel.right_type] || "") : "";
  const auctionPrice = parcel?.detail?.auction_price ?? 0;
  const acqArea = parcel?.acquisition_area_m2 ?? 0;
  const totalArea = parcel?.area_m2 ?? 0;

  // Row 5 — acquisition name (merged B5:N5)
  if (acquisitionName) {
    ws["B5"] = { v: acquisitionName, t: "s" };
  }

  // Row 6 — data row (0-based index 5)
  setCell("B6", 1);
  setCell("C6", fullName || "—");
  setCell("D6", address || "—");
  setCell("E6", parcel?.parcel_id || "");
  setCell("F6", totalArea);
  setCell("G6", rightLabel);
  setCell("H6", parcel?.detail?.certificate_no || "");
  setCell("I6", acqArea);
  setCell("J6", auctionPrice);
  setCell("K6", "");
  setCell("L6", 0);
  setCell("M6", 0);
  setCell("N6", auctionPrice);

  // Row 12 — totals
  setCell("F12", totalArea);
  setCell("G12", 0);
  setCell("H12", 0);
  setCell("I12", acqArea);
  setCell("J12", auctionPrice);
  setCell("K12", 0);
  setCell("L12", 0);
  setCell("M12", 0);
  setCell("N12", auctionPrice);

  ws["!ref"] = "B2:N12";

  const fileName = `захирамжийн_төсөл_${parcel?.parcel_id || "draft"}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

const TEMPLATES: PrintTemplate[] = [
  {
    id: "medegdekh_huudas",
    name: "Урьдчилан мэдэгдэх хуудас",
    description: "Захиргааны Ерөнхий хуулийн 26-р зүйлийн дагуу урьдчилан мэдэгдэх хуудас",
    filename: "medegdeh_huudas.docx",
    isDownload: true,
  },
  {
    id: "medegdekh_huudas_org",
    name: "Урьдчилан мэдэгдэх хуудас (Байгууллага)",
    description: "Захиргааны Ерөнхий хуулийн 26-р зүйлийн дагуу урьдчилан мэдэгдэх хуудас",
    filename: "medegdeh_huudas_org.docx",
    isDownload: true,
  },
  {
    id: "survey_form",
    name: "Санал асуулгын хуудас",
    description: "Санал асуулгын маягт",
    filename: "sanal_asuulgiin_huudas.docx",
    isDownload: true,
  },
  {
    id: "socioeconomic_survey",
    name: "Нийгэм эдийн засгийн судалгаа",
    description: "Нийгэм эдийн засгийн судалгааны маягт",
    filename: "niigem_ediin_zasag_sudalgaa.docx",
    isDownload: true,
  },
  {
    id: "valuation_checklist",
    name: "Шалгах хуудас",
    description: "Газар, үл хөдлөх эд хөрөнгийн нөхөх олговрын зориулалттай үнэлгээний шалгах хуудас",
    filename: "shalgah_huudas.docx",
    isDownload: true,
  },
  {
    id: "meeting_minutes",
    name: "Хурлын тэмдэглэл",
    description: "Хурлын тэмдэглэлийн маягт",
    filename: "hurliin_temdeglel.docx",
    isDownload: true,
  },
  {
    id: "acquisition_contract",
    name: "Нөхөх олговор олгох гэрээ",
    description: "Нөхөх олговрын гэрээ — үл хөдлөх хөрөнгийн бүртгэлээр автоматаар бөглөнө. Хэвлэхийн өмнө \"Хурлын тэмдэглэл\" (DOCX) хавсралт шаардлагатай бөгөөд гэрээний ард залгагдана",
    filename: "acquisition_contract.docx",
    isDownload: true,
    requiresMeetingMinutes: true,
  },
  {
    id: "acquisition_contract_add_gazar",
    name: "Газар+Нөхөх олговор гэрээ",
    description: "Газар чөлөөлөх гэрээ (газар дүйцүүлэлт ба нөхөх олговор) — үл хөдлөх хөрөнгийн бүртгэлээр автоматаар бөглөнө. Хэвлэхийн өмнө \"Хурлын тэмдэглэл\" (DOCX) хавсралт шаардлагатай бөгөөд гэрээний ард залгагдана",
    filename: "acquisition_contract_add_gazar.docx",
    isDownload: true,
    requiresMeetingMinutes: true,
  },
  {
    id: "acquisition_contract_only_gazar",
    name: "Газар дүйцүүлэх гэрээ",
    description: "Газар чөлөөлөх гэрээ (зөвхөн газар дүйцүүлэлт). Хэвлэхийн өмнө \"Хурлын тэмдэглэл\" (DOCX) хавсралт шаардлагатай бөгөөд гэрээний ард залгагдана",
    filename: "acquisition_contract_only_gazar.docx",
    isDownload: true,
    requiresMeetingMinutes: true,
  },
  {
    id: "contract_review_act",
    name: "Гэрээ дүгнэсэн акт",
    description: "Нөхөх олговрын гэрээний гүйцэтгэлийг дүгнэсэн акт",
    filename: "geree_dugnesen_akt.docx",
    isDownload: true,
  },
  {
    id: "appointment_minutes",
    name: "Уулзалтын тэмдэглэл",
    description: "Уулзалтын тэмдэглэлийн загвар маягт",
    filename: "uulzaltiin_temdeglel.docx",
    isDownload: true,
  },
  {
    id: "conflict_of_interest_employee",
    name: "Ашиг сонирхолын мэдүүлэг (Ажилтан)",
    description: "Ажилтны ашиг сонирхлын урьдчилсан мэдүүлгийн маягт",
    filename: "ashig_sonirholiin_medegdel_employee.docx",
    isStaticFile: true,
  },
  {
    id: "conflict_of_interest_director",
    name: "Ашиг сонирхолын мэдүүлэг (Дарга)",
    description: "Даргын ашиг сонирхлын урьдчилсан мэдүүлгийн маягт",
    filename: "ashig_sonirholiin-medegdel_darga.docx",
    isStaticFile: true,
  },
  {
    id: "decision_draft",
    name: "Захирамжийн төсөл",
    description: "Нэгж талбарын мэдээллээр дүүргэсэн захирамжийн төслийн Excel маягт",
    filename: "decition_draft.xlsx",
    isExcel: true,
  },
  {
    id: "land_handover_act",
    name: "Чөлөөлсөн газрыг хүлээлцсэн акт",
    description: "Газар чөлөөлөх үед хүлээлцэх акт",
    filename: "gazar_huleelcsen_akt.docx",
    isDownload: true,
  },
  {
    id: "land_handover_act_2",
    name: "Чөлөөлсөн газрыг хүлээлцсэн акт 2",
    description: "Газар чөлөөлөх үед хүлээлцэх акт — 2 дахь хувилбар",
    filename: "gazar_huleelcsen_akt-2.docx",
    isDownload: true,
  },
  {
    id: "monitoring_card",
    name: "Хяналтын карт",
    description: "Нэгж талбарын хяналтын картын маягт",
    filename: "hynalt_card.docx",
    isDownload: true,
  },
  {
    id: "monitoring_card_2",
    name: "Хяналтын карт 2",
    description: "Гүйцэтгэлийн гэрээ байгуулах явцын хяналтын карт — 2 дахь хувилбар",
    filename: "hyanalt_card_2.docx",
    isDownload: true,
  },
  {
    id: "payment_processing",
    name: "Төлбөрийн гүйцэтгэл",
    description: "Төлбөрийн гүйцэтгэлийн Excel маягт",
    filename: "tulbur_guitsegel.xlsx",
    isExcel: true,
    isStaticFile: true,
  },
];

export function PrintTemplatesTab({ parcel }: { parcel?: ParcelFull }) {
  const acqId = parcel?.acquisition_id;
  const valuationType = parcel?.selected_valuation_type || "asset";

  const { data: acquisition } = useQuery({
    queryKey: ["land", acqId],
    queryFn: () => landApi.getById(acqId!),
    enabled: !!acqId,
  });

  const { data: assetsResult } = useQuery({
    queryKey: ["assets", acqId, parcel?.parcel_id, valuationType],
    queryFn: () => landApi.getAssets(acqId!, { page: 1, page_size: 200, parcel_id: parcel?.parcel_id, valuation_type: valuationType }),
    enabled: !!acqId && !!parcel?.parcel_id,
  });
  const assets = assetsResult?.data ?? [];

  const { data: compensations = [] } = useQuery({
    queryKey: ["compensations", acqId, parcel?.parcel_id, valuationType],
    queryFn: () => landApi.listCompensations(acqId!, parcel?.parcel_id, valuationType),
    enabled: !!acqId && !!parcel?.parcel_id,
  });

  const { data: landValuation } = useQuery({
    queryKey: ["land-valuation", acqId, parcel?.parcel_id, valuationType],
    queryFn: () => landApi.getLandValuation(acqId!, parcel!.parcel_id, valuationType),
    enabled: !!acqId && !!parcel?.parcel_id,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["parcel-documents", parcel?.id],
    queryFn: () => parcelApi.listDocuments(parcel!.id),
    enabled: !!parcel?.id,
  });

  const { data: docTypes = [] } = useQuery({
    queryKey: ["document-types", "parcel"],
    queryFn: () => documentTypeApi.list("parcel"),
    staleTime: 60_000,
  });

  const meetingMinutesAttachment = findMeetingMinutesDocxAttachment(docs, docTypes);

  // Иргэн бол "Урьдчилан мэдэгдэх хуудас", хуулийн этгээд бол түүний
  // БАЙГУУЛЛАГЫН хувилбарыг л харуулна (нөгөөг нь нуух).
  const orgHolder = isLegalEntityHolder(parcel);
  const visibleTemplates = TEMPLATES.filter((t) =>
    t.id === "medegdekh_huudas" ? !orgHolder
      : t.id === "medegdekh_huudas_org" ? orgHolder
        : true,
  );

  return (
    <div className="ap-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Эх хэвлэлүүд</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Татах дарахад HTML маягт нээгдэж &ldquo;PDF хадгалах&rdquo; товчоор хадгална. Word (docx) болон Excel маягт шууд татагдана.
        </p>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
        {visibleTemplates.map((tpl, idx) => (
          <div
            key={tpl.id}
            className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-[#2a2b38]">
              {tpl.isExcel
                ? <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                : <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{idx + 1}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{tpl.name}</p>
                {tpl.isExcel && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    XLSX
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{tpl.description}</p>
              {tpl.requiresMeetingMinutes && !meetingMinutesAttachment && (
                <p className="text-[11px] text-red-500 mt-0.5">
                  Эхлээд &ldquo;Баримт бичиг&rdquo; табаас &ldquo;Хурлын тэмдэглэл&rdquo; (DOCX) хавсаргана уу
                </p>
              )}
            </div>
            <button
              onClick={() =>
                tpl.requiresMeetingMinutes
                  ? downloadAcquisitionContract({
                      template: tpl.filename,
                      parcel,
                      acquisition,
                      assets,
                      compensations,
                      landValuation,
                      attachment: meetingMinutesAttachment,
                    }).catch((err) => {
                      toast.error(err instanceof Error ? err.message : "Гэрээ үүсгэхэд алдаа гарлаа");
                    })
                  : tpl.isStaticFile
                    ? downloadFile(tpl)
                    : tpl.isExcel
                      ? downloadDecisionDraft(parcel, acquisition?.acquisition_name)
                      : tpl.isDownload
                        ? downloadDocxTemplate(tpl, parcel, acquisition).catch((err) => {
                            toast.error(err instanceof Error ? err.message : "DOCX файл татахад алдаа гарлаа");
                          })
                        : openTemplate(tpl, parcel)
              }
              className={`flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap ${
                tpl.isExcel
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-[#02c0ce]/10 text-[#02c0ce] hover:bg-[#02c0ce]/20"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              Татах
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
