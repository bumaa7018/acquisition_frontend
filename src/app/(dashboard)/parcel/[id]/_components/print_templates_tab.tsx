"use client";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import { formatArea } from "@/lib/utils";
import type { LandAcquisition, ParcelFull } from "@/types";
import { RIGHT_TYPE_LABELS } from "@/types";

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
  if (!win) alert("Попап цонх блоклогдсон байна. Браузерын тохиргооноос зөвшөөрнө үү.");
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

function formatTemplateDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(value?: number) {
  return value == null ? "" : value.toLocaleString("mn-MN");
}

function firstLetter(value?: string) {
  return value?.trim().charAt(0) || "";
}

function getAssignedEmployee(acquisition?: LandAcquisition) {
  const assigned = acquisition?.assigned_users?.[0];
  if (assigned?.user_name) {
    const parts = assigned.user_name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");

    return {
      firstName,
      lastName,
      position: assigned.user_position || "",
      phone: (assigned as { phone?: string; user_phone?: string }).phone || (assigned as { user_phone?: string }).user_phone || "",
    };
  }

  const user = authStorage.getUser() as
    | { first_name?: string; last_name?: string; full_name?: string; position?: string; phone?: string; mobile?: string }
    | null;
  if (!user) return { firstName: "", lastName: "", position: "", phone: "" };

  const fullNameParts = user.full_name?.trim().split(/\s+/).filter(Boolean) || [];
  const firstName = user.first_name || fullNameParts[0] || "";
  const lastName = user.last_name || fullNameParts.slice(1).join(" ");

  return {
    firstName,
    lastName,
    position: user.position || "",
    phone: user.phone || user.mobile || "",
  };
}

function findAdminUnitName(
  aus: LandAcquisition["aus"] | undefined,
  code: string | undefined,
  key: "au1" | "au2" | "au3"
) {
  if (!code) return "";
  const codeKey = `${key}_code` as const;
  const nameKey = `${key}_name` as const;
  const unit = aus?.find((item) => String(item[codeKey] || "") === String(code));
  return unit?.[nameKey] || "";
}

function buildDocxTemplateValues(parcel?: ParcelFull, acquisition?: LandAcquisition) {
  const detail = parcel?.detail;
  const now = new Date();
  const assignedEmployee = getAssignedEmployee(acquisition);
  const holderName = [detail?.holder_last_name, detail?.holder_name].filter(Boolean).join(" ");
  const au = acquisition?.aus?.find((item) =>
    (!parcel?.au1_code || String(item.au1_code || "") === String(parcel.au1_code)) &&
    (!parcel?.au2_code || String(item.au2_code || "") === String(parcel.au2_code)) &&
    (!parcel?.au3_code || String(item.au3_code || "") === String(parcel.au3_code))
  );
  const au1Name = au?.au1_name || findAdminUnitName(acquisition?.aus, parcel?.au1_code, "au1");
  const au2Name = au?.au2_name || findAdminUnitName(acquisition?.aus, parcel?.au2_code, "au2");
  const au3Name = au?.au3_name || findAdminUnitName(acquisition?.aus, parcel?.au3_code, "au3");
  const address = [au1Name, au2Name, au3Name].filter(Boolean).join(" ");
  const rightType = parcel ? RIGHT_TYPE_LABELS[parcel.right_type] || "" : "";
  const compensationTotal =
    (parcel?.cash_amount ?? 0) + (parcel?.land_grant_amount ?? 0);
  const remainingArea =
    parcel?.remaining_area_m2 ?? ((parcel?.area_m2 ?? 0) - (parcel?.acquisition_area_m2 ?? 0));

  return {
    current_date: now.toLocaleDateString("mn-MN"),
    date: now.toLocaleDateString("mn-MN"),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
    city: "Улаанбаатар хот",

    acquisition_name: acquisition?.acquisition_name || "",
    acquisition_id: parcel?.acquisition_id || "",
    parcel_id: parcel?.parcel_id || "",
    old_parcel_id: parcel?.old_parcel_id || "",
    changed_parcel_id: parcel?.changed_parcel_id || "",
    landuse: parcel?.landuse || "",
    status_name: parcel?.status_name || "",
    right_type: rightType,
    right_type_label: rightType,
    parcel_right_type_name: rightType,
    area_m2: parcel?.area_m2 ?? "",
    area: formatArea(parcel?.area_m2),
    acquisition_area_m2: parcel?.acquisition_area_m2 ?? "",
    affected_area_m2: parcel?.acquisition_area_m2 ?? "",
    acquisition_area: formatArea(parcel?.acquisition_area_m2),
    remaining_area_m2: remainingArea,
    remaining_area: formatArea(remainingArea),
    address,
    au1_code: parcel?.au1_code || "",
    au2_code: parcel?.au2_code || "",
    au3_code: parcel?.au3_code || "",
    au1_name: au1Name,
    au2_name: au2Name,
    au3_name: au3Name,

    holder_name: holderName,
    full_name: holderName,
    citizen_name: holderName,
    owner_name: holderName,
    owner_lastname: detail?.holder_last_name || "",
    owner_lastname_first_spell: firstLetter(detail?.holder_last_name),
    owner_firstname: detail?.holder_name || "",
    owner_register: detail?.holder_register_no || "",
    owner_phone: detail?.holder_phone || "",
    holder_last_name: detail?.holder_last_name || "",
    holder_first_name: detail?.holder_name || "",
    holder_register_no: detail?.holder_register_no || "",
    register_no: detail?.holder_register_no || "",
    phone: detail?.holder_phone || "",
    holder_phone: detail?.holder_phone || "",
    holder_email: detail?.holder_email || "",
    holder_type: detail?.holder_type || "",
    holder_civil_id: detail?.holder_civil_id || "",

    app_no: detail?.app_no || "",
    decision_no: detail?.decision_no || "",
    decision_date: formatTemplateDate(detail?.decision_date),
    contract_no: detail?.contract_no || "",
    contract_date: formatTemplateDate(detail?.contract_date),
    certificate_no: detail?.certificate_no || "",
    building_certificate_no: detail?.certificate_no || "",
    certificate_date: formatTemplateDate(detail?.certificate_date),
    valuation_zone: detail?.valuation_zone || "",
    base_price_per_ha: formatMoney(detail?.base_price_per_ha),
    auction_coeff: detail?.auction_coeff ?? "",
    auction_price: formatMoney(detail?.auction_price),
    land_purpose: parcel?.landuse || "",
    street_name: "",
    door_number: "",
    assigned_emp_lastname_first_spell: firstLetter(assignedEmployee.lastName),
    assigned_emp_firstname: assignedEmployee.firstName,
    assigned_emp_position: assignedEmployee.position,
    assigned_emp_phone: assignedEmployee.phone,
    compansation_total_amount: formatMoney(compensationTotal),
    compensation_total_amount: formatMoney(compensationTotal),
    comensation_total_amount: formatMoney(compensationTotal),

    "овог_нэр": holderName,
    "иргэний_нэр": holderName,
    "нэгж_талбарын_дугаар": parcel?.parcel_id || "",
    "утас": detail?.holder_phone || "",
    "хаяг": address,
    "регистрийн_дугаар": detail?.holder_register_no || "",
    "талбай": formatArea(parcel?.area_m2),
    "нөлөөлөлд_өртсөн_талбай": formatArea(parcel?.acquisition_area_m2),
    "эрхийн_төрөл": rightType,
    "гэрчилгээний_дугаар": detail?.certificate_no || "",
  };
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
    headers: { "Content-Type": "application/json" },
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
    id: "appointment_minutes",
    name: "Уулзалтын тэмдэглэл",
    description: "Уулзалтын тэмдэглэлийн загвар маягт",
    filename: "uulzaltiin_temdeglel.docx",
    isDownload: true,
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
    id: "payment_processing",
    name: "Төлбөрийн гүйцэтгэл",
    description: "Төлбөрийн гүйцэтгэлийн Excel маягт",
    filename: "tulbur_guitsegel.xlsx",
    isExcel: true,
    isStaticFile: true,
  },
];

export function PrintTemplatesTab({ parcel }: { parcel?: ParcelFull }) {
  const { data: acquisition } = useQuery({
    queryKey: ["land", parcel?.acquisition_id],
    queryFn: () => landApi.getById(parcel!.acquisition_id),
    enabled: !!parcel?.acquisition_id,
  });

  return (
    <div className="ap-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Эх хэвлэлүүд</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Татах дарахад HTML маягт нээгдэж &ldquo;PDF хадгалах&rdquo; товчоор хадгална. Word (docx) болон Excel маягт шууд татагдана.
        </p>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
        {TEMPLATES.map((tpl, idx) => (
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
            </div>
            <button
              onClick={() =>
                tpl.isStaticFile
                  ? downloadFile(tpl)
                  : tpl.isExcel
                    ? downloadDecisionDraft(parcel, acquisition?.acquisition_name)
                    : tpl.isDownload
                      ? downloadDocxTemplate(tpl, parcel, acquisition).catch((err) => {
                          alert(err instanceof Error ? err.message : "DOCX файл татахад алдаа гарлаа");
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
