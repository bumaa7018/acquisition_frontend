"use client";
import { X, Map as MapIcon, FileText, CalendarClock, Users, Shield } from "lucide-react";
import { formatArea, formatDate } from "@/lib/utils";
import {
  MAP_LAYER_STYLES,
  AGREED_CODE_LAYERS,
  SEC_CODE_LAYERS,
  type MapLayerId,
} from "./layer-config";

/**
 * ГУС-ийн давхарга (шинэ зөвшилцсөн зураг / хамгаалалтын зурвас) дээр дарахад
 * гарах ДЭЛГЭРЭНГҮЙ цонх.
 *
 * Загвар нь нэгж талбарын цонхтой (parcel-info-modal) ижил — толгой + хэсэгчилсэн
 * мөрүүд. ЯЛГАА: дэвсгэр нь төлөвийн өнгөөр будагдахгүй, ЦАГААН (dark горимд
 * апп-ын хар гадаргуу) — ГУС-ийн эдгээр бүртгэл "явц" гэсэн төлөв агуулдаггүй
 * тул өнгөт дэвсгэр утга нэмэхгүй, зөвхөн уншихад хүндрүүлнэ.
 *
 * API ДУУДАХГҮЙ: ГУС-ийн хүснэгтүүд appdb-д хуулагддаггүй тул backend endpoint
 * байхгүй. Бүх талбар нь дарахад аль хэдийн татсан GetFeatureInfo-ийн
 * шинжүүдээс (properties) шууд гарна — нэмэлт хүсэлт үүсэхгүй.
 *
 * ХООСОН ХЭСЭГ ХАРАГДАХГҮЙ: ГУС дээр багана байгаа ч бөглөгдөөгүй тохиолдол
 * ХЭВИЙН (хэмжсэн: хамгаалалтын зурвасын `ajliin_turul`, `huchin_chadal`,
 * `working_org`, `confirm_date` нь 163527 мөрөөс 0 бөглөгдсөн). Бүх талбар нь
 * хоосон хэсгийг зурвал цонх хоосон мөрөөр дүүрнэ — тиймээс тухайн хэсгийг
 * бүхэлд нь алгасна. Харин ГУС дараа нь бөглөвөл ӨӨРӨӨ гарч ирнэ (код
 * өөрчлөх шаардлагагүй).
 */

/** GetFeatureInfo-ийн буцаадаг шинжүүд — талбар бүр байхгүй байж болно. */
export type GusFeatureProps = Record<string, unknown>

type Field = {
  label: string
  /** Шинжийн нэр(ууд) — олон бол хоосон биш нь таслалаар нийлнэ. */
  keys: string[]
  kind?: "text" | "area" | "date"
  /** Утга бүрийг чимэглэх (жишээ: хорооны дугаарт "-р хороо" залгах). */
  suffix?: string
}

type SectionSpec = {
  icon: React.ElementType
  /** ЭХНИЙ хэсэгт гарчиг байхгүй (толгойн доор шууд мөрүүд). */
  title?: string
  fields: Field[]
}

function text(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  // ГУС-ийн текст талбарт "NULL"/"null" гэсэн БИЧВЭР таарна (жинхэнэ хоосон
  // биш) — хэрэглэгчид "NULL" гэж харуулах нь алдаа шиг уншигдана.
  return /^(null|undefined)$/i.test(s) ? "" : s;
}

function fieldValue(props: GusFeatureProps, f: Field): string {
  const parts = f.keys.map((k) => {
    const raw = text(props[k]);
    if (!raw) return "";
    if (f.kind === "area") {
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? formatArea(n) : "";
    }
    if (f.kind === "date") {
      // ГУС-ийн "хязгааргүй" хүчинтэй хугацаа (valid_till = 'infinity') нь
      // 292278994 он болж ирдэг — огноо болгож харуулах нь утгагүй.
      if (/^\d{5,}/.test(raw)) return "хязгааргүй";
      return formatDate(raw);
    }
    return f.suffix ? `${raw}${f.suffix}` : raw;
  });
  return parts.filter(Boolean).join(", ");
}

/** ШИНЭ ЗӨВШИЛЦСӨН ЗУРАГ — `ca_agreed_parcel` (ГУС) хүснэгтийн талбарууд. */
const AGREED_SECTIONS: SectionSpec[] = [
  {
    icon: MapIcon,
    fields: [
      { label: "Ажлын төрөл", keys: ["work_type"] },
      { label: "Ажлын нэр", keys: ["work_name"] },
      { label: "Хүчин чадал", keys: ["capacity"] },
      { label: "Талбай", keys: ["area_m2"], kind: "area" },
      { label: "Байршил", keys: ["au2s", "au3s"] },
    ],
  },
  {
    icon: FileText,
    title: "Шийдвэр",
    fields: [
      { label: "Хөрөнгө оруулалтын хэлбэр", keys: ["investment_form"] },
      { label: "Шийдвэрийн үндэслэл", keys: ["reason_decision"] },
    ],
  },
  {
    icon: CalendarClock,
    title: "Хугацаа",
    fields: [
      { label: "Зөвшилцсөн", keys: ["agreed_date"], kind: "date" },
      { label: "Эхлэх", keys: ["start_date"], kind: "date" },
      { label: "Дуусах", keys: ["end_date"], kind: "date" },
    ],
  },
  {
    icon: Users,
    title: "Ажилтнууд",
    fields: [
      { label: "Зөвшилцсөн", keys: ["emp_zovsh"] },
      { label: "Хянасан", keys: ["emp_hyanasan"] },
      { label: "Танилцсан", keys: ["emp_taniltscan"] },
      { label: "Боловсруулсан", keys: ["emp_bolovs"] },
    ],
  },
];

/**
 * ХАМГААЛАЛТЫН ЗУРВАС — `ca_sec_parcel` (ГУС).
 *
 * АНХААР: доорх талбаруудын нэг хэсэг нь GeoServer уншдаг ГУС-ийн ХАРАГДАЦАД
 * (view `data_landuse.ca_sec_parcel`) БАЙХГҮЙ — тэдгээр нь зөвхөн эх хүснэгтэд
 * (`ca_sec_parcel_tbl`) байдаг: ajliin_turul, huchin_chadal, h_orulalt_helber,
 * technic_nuhtsul, ajliin_ner, working_org, confirm_date, empl_*, au1/au2/au3,
 * name, type. Тэр хүснэгтэд ч эдгээр нь бараг бөглөгдөөгүй (хэмжсэн, 163527
 * мөр: ajliin_turul / huchin_chadal / h_orulalt_helber / technic_nuhtsul /
 * working_org / confirm_date / empl_hyanasan / empl_bolovsuulsan = 0 мөр;
 * ajliin_ner = 580; empl_zuvsh = 495; au2 = 546; name = 32790; type = 12170).
 *
 * Тиймээс ЭНД БҮГДИЙГ бичив: ГУС харагдацдаа эдгээр баганыг нэмэх (эсвэл
 * GeoServer-ийн давхаргыг хүснэгт рүү холбох) үед цонхонд ӨӨРӨӨ гарч ирнэ.
 * Одоохондоо хоосон талбар/хэсэг нь ХАРАГДАХГҮЙ (дээрх тайлбарыг үз).
 */
const SEC_SECTIONS: SectionSpec[] = [
  {
    icon: Shield,
    fields: [
      { label: "Зурвасын төрөл", keys: ["explan"] },
      { label: "Талбай", keys: ["area_m2"], kind: "area" },
      { label: "Зориулалтын код", keys: ["landuse"] },
      { label: "Нэмэлт код", keys: ["code1", "code2", "code3"] },
      { label: "Нэр", keys: ["name"] },
    ],
  },
  {
    icon: FileText,
    title: "Ажил",
    fields: [
      { label: "Ажлын төрөл", keys: ["ajliin_turul"] },
      { label: "Ажлын нэр", keys: ["ajliin_ner"] },
      { label: "Хүчин чадал", keys: ["huchin_chadal"] },
      { label: "Хөрөнгө оруулалтын хэлбэр", keys: ["h_orulalt_helber"] },
      { label: "Техникийн нөхцөл", keys: ["technic_nuhtsul"] },
      { label: "Гүйцэтгэгч", keys: ["working_org"] },
    ],
  },
  {
    icon: CalendarClock,
    title: "Хугацаа",
    fields: [
      { label: "Хүчинтэй эхлэх", keys: ["valid_from"], kind: "date" },
      { label: "Хүчинтэй дуусах", keys: ["valid_till"], kind: "date" },
      { label: "Батлагдсан", keys: ["confirm_date"], kind: "date" },
    ],
  },
  {
    icon: Users,
    title: "Ажилтнууд",
    fields: [
      { label: "Зөвшилцсөн", keys: ["empl_zuvsh"] },
      { label: "Хянасан", keys: ["empl_hyanasan"] },
      { label: "Боловсруулсан", keys: ["empl_bolovsuulsan"] },
    ],
  },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="w-40 shrink-0 text-[11.5px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
        {value || "—"}
      </span>
    </div>
  );
}

export default function GusInfoModal({
  layerId,
  properties,
  onClose,
}: {
  /** Дарсан дэд давхаргын id (`ca_agreed_c48`, `ca_sec_c19` г.м.) */
  layerId: string;
  properties: GusFeatureProps;
  onClose: () => void;
}) {
  const isSec = layerId.startsWith("ca_sec");
  const code = String(properties.code ?? "");
  // Өнгө/нэр нь ДАРСАН давхаргаас; олдохгүй бол (шүүлт зөрөх онцгой
  // тохиолдол) `code`-оор нь хайна, эцэст нь эх давхаргын өнгөөр.
  const list = isSec ? SEC_CODE_LAYERS : AGREED_CODE_LAYERS;
  const sub =
    list.find((l) => l.id === layerId) ?? list.find((l) => String(l.code ?? "") === code);
  const parentId: MapLayerId = isSec ? "ca_sec_parcel" : "ca_agreed_parcel";
  const color = sub?.color ?? MAP_LAYER_STYLES[parentId].color;
  const label = MAP_LAYER_STYLES[layerId as MapLayerId]?.label ?? sub?.label ?? MAP_LAYER_STYLES[parentId].label;

  // Гарчиг: тухайн объектын НЭР (байвал), эс бөгөөс дэд төрлийн нэр.
  const heading = text(properties.work_name) || text(properties.ajliin_ner) || text(properties.name) || label;

  const sections = (isSec ? SEC_SECTIONS : AGREED_SECTIONS)
    .map((s) => ({
      ...s,
      rows: s.fields.map((f) => ({ label: f.label, value: fieldValue(properties, f) })),
    }))
    // Бүхэлдээ хоосон хэсгийг алгасна (эхний хэсэг үргэлж харагдана — тэр нь
    // объектыг танихад хэрэгтэй үндсэн мөрүүд).
    .filter((s, i) => i === 0 || s.rows.some((r) => r.value));

  const HeadIcon = sections[0]?.icon ?? MapIcon;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Дэвсгэр ЦАГААН — зөвхөн толгойн дүрс/нэр нь дэд төрлийн өнгөтэй. */}
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-[#1e1f27]"
        style={{ borderColor: `${color}55` }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: `1px solid ${color}33` }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${color}22` }}
            >
              <HeadIcon className="h-4 w-4" style={{ color }} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-slate-800 dark:text-white">{heading}</p>
              <p className="truncate text-[11px] font-semibold" style={{ color }}>
                {label}
                {code ? ` · код ${code}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title ?? "main"}
                className={
                  i === 0
                    ? "px-5 py-3"
                    : "border-t border-slate-100 px-5 py-3 dark:border-[#37394d]"
                }
              >
                {s.title && (
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    <Icon className="h-3 w-3" />
                    {s.title}
                  </p>
                )}
                {s.rows.map((r) => (
                  <Row key={r.label} label={r.label} value={r.value} />
                ))}
              </div>
            );
          })}

          {/* ГУС-ийн бүртгэлийн дугаарууд — асуудал мэдээлэхэд хэрэгтэй тул
              жагсаалтын ЭЦЭСТ, бүдэг харуулна. */}
          <div className="border-t border-slate-100 px-5 py-2.5 dark:border-[#37394d]">
            <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
              ГУС-ийн дугаар: {text(properties.geo_id) || "—"}
              {isSec && text(properties.parcel_id) ? ` · parcel_id ${text(properties.parcel_id)}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
