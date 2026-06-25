"use client";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import type { ParcelFull } from "@/types";
import { RIGHT_TYPE_LABELS } from "@/types";

interface PrintTemplate {
  id: string;
  name: string;
  description: string;
  filename: string;
  isDynamic?: boolean;
  isExcel?: boolean;
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
    filename: "medegdekh_huudas.html",
    isDynamic: true,
  },
  {
    id: "survey_form",
    name: "Санал асуулгын хуудас",
    description: "Санал асуулгын маягт",
    filename: "survey_form.html",
  },
  {
    id: "socioeconomic_survey",
    name: "Нийгэм эдийн засгийн судалгаа",
    description: "Нийгэм эдийн засгийн судалгааны маягт",
    filename: "socioeconomic_survey.html",
  },
  {
    id: "valuation_checklist",
    name: "Шалгах хуудас",
    description: "Газар, үл хөдлөх эд хөрөнгийн нөхөх олговрын зориулалттай үнэлгээний шалгах хуудас",
    filename: "valuation_checklist.html",
  },
  {
    id: "meeting_minutes_draft",
    name: "Хурлын тэмдэглэлийн драфт",
    description: "Хурлын тэмдэглэлийн драфт загвар",
    filename: "meeting_minutes_template.html",
  },
  {
    id: "contract_template",
    name: "Гэрээний загвар",
    description: "Гэрээний загвар маягт",
    filename: "medegdekh_huudas.html",
  },
  {
    id: "meeting_minutes",
    name: "Хурлын тэмдэглэл",
    description: "Хурлын тэмдэглэлийн маягт",
    filename: "meeting_minutes.html",
  },
  {
    id: "appointment_minutes",
    name: "Уулзалтын тэмдэглэл",
    description: "Уулзалтын тэмдэглэлийн загвар маягт",
    filename: "meeting_minutes_template.html",
  },
  {
    id: "decision_draft",
    name: "Захирамжийн төсөл",
    description: "Нэгж талбарын мэдээллээр дүүргэсэн захирамжийн төслийн Excel маягт",
    filename: "decition_draft.xlsx",
    isExcel: true,
  },
  {
    id: "compensation_execution",
    name: "Нөхөх олговорын гүйцэтгэл",
    description: "Нөхөх олговорын гүйцэтгэлийн маягт",
    filename: "medegdekh_huudas.html",
  },
  {
    id: "land_handover_act",
    name: "Чөлөөлсөн газрыг хүлээлцсэн акт",
    description: "Газар чөлөөлөх үед хүлээлцэх акт",
    filename: "land_handover_act.html",
  },
  {
    id: "land_handover_act_2",
    name: "Чөлөөлсөн газрыг хүлээлцсэн акт 2",
    description: "Газар чөлөөлөх үед хүлээлцэх акт — 2 дахь хувилбар",
    filename: "land_handover_act_2.html",
  },
  {
    id: "contract_progress_monitoring",
    name: "Гүйцэтгэлийн гэрээ байгуулах явцын хяналтын карт",
    description: "Гүйцэтгэлийн гэрээ байгуулах явцын хяналтын картын маягт",
    filename: "valuation_checklist.html",
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
          Татах дарахад баримт нээгдэнэ — дотор байгаа "PDF хадгалах" товчоор хадгална. Excel маягт шууд татагдана.
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
                tpl.isExcel
                  ? downloadDecisionDraft(parcel, acquisition?.acquisition_name)
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
