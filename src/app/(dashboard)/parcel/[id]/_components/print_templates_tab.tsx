"use client";
import { FileText, Download } from "lucide-react";
import type { ParcelFull } from "@/types";

interface PrintTemplate {
  id: string;
  name: string;
  description: string;
  filename: string;
  isDynamic?: boolean;
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
  return (
    <div className="ap-card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#37394d]">
        <p className="text-[13px] font-semibold text-slate-700 dark:text-white">Эх хэвлэлүүд</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Татах дарахад баримт нээгдэнэ — дотор байгаа "PDF хадгалах" товчоор хадгална
        </p>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
        {TEMPLATES.map((tpl, idx) => (
          <div
            key={tpl.id}
            className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-[#252630] transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-[#2a2b38]">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">{idx + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{tpl.name}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{tpl.description}</p>
            </div>
            <button
              onClick={() => openTemplate(tpl, parcel)}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#02c0ce]/10 text-[#02c0ce] text-[12px] font-semibold hover:bg-[#02c0ce]/20 transition-colors whitespace-nowrap"
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
