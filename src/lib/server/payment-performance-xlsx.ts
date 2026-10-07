import ExcelJS from "exceljs";
import { computePaymentPerformance, type PaymentPerformanceInput } from "@/lib/payment-performance";

export interface PaymentPerformanceSheetInput extends PaymentPerformanceInput {
  acquisitionName?: string;
  /** «Эхлэх ба дуусах хугацаа» — ж: 2025.06.03-2025.07.03 */
  period?: string;
  /** Гүйцэтгэл гаргасан огноо — ж: 2025.10.06 */
  date: string;
}

const MONEY = "#,##0";

/**
 * public/templates/tulbur_guitsegel.xlsx-ийг ЗАГВАРЫН ХЭВ МАЯГААР нь (хүрээ,
 * формат, нэгтгэсэн нүд) хадгалан бөглөнө. Нүднүүд:
 *
 *   13 Газрын үнэлгээ · 14 Үл хөдлөх хөрөнгө · 15 Эд хөрөнгө · 16 БҮГД ДҮН
 *   D Төсөвт өртөг (нийт үнэлгээ) · E Ажил эхэлснээс хойшхи гүйцэтгэл
 *   F Урьд авсан санхүүжилт · G Тайлант үеийн гүйцэтгэл · H Хянасан гүйцэтгэл
 *   I Төсөвт өртөгт эзлэх хувь (хуримтлагдсан) · J Үлдэгдэл санхүүжилт
 *   17 Бодит ажлын явц /хувиар/ · 21–25 Үе шатны ажлын хуваарь
 */
export async function fillPaymentPerformance(template: Buffer, input: PaymentPerformanceSheetInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const p = computePaymentPerformance(input);
  // №2 — хоёр дахь олголт (40%); 60% ба нэг удаагийн 100% — №1.
  const no = input.stage === 40 ? 2 : 1;

  const set = (addr: string, value: ExcelJS.CellValue, numFmt?: string) => {
    const cell = ws.getCell(addr);
    cell.value = value;
    if (numFmt) cell.numFmt = numFmt;
  };

  set("C7", ` ИРГЭН, ХУУЛИЙН ЭТГЭЭДИЙН ГАЗАР, ЭД ХӨРӨНГИЙН НӨХӨХ ОЛГОВРЫН ГҮЙЦЭТГЭЛ №${no}`);
  if (input.acquisitionName) set("E8", input.acquisitionName);
  // Гэрээний дугаарыг загварын жишээ утгаар үлдээхгүй — гараас бөглөнө.
  set("E9", "");
  set("E10", input.period ?? "");
  set("E11", input.date);

  const rows: [number, ReturnType<typeof computePaymentPerformance>["land"]][] = [
    [13, p.land],
    [14, p.realEstate],
    [15, p.property],
    [16, p.total],
  ];
  for (const [r, v] of rows) {
    set(`D${r}`, v.budget, MONEY);
    set(`E${r}`, v.cumulative, MONEY);
    set(`F${r}`, v.prior, MONEY);
    set(`G${r}`, v.current, MONEY);
    set(`H${r}`, v.current, MONEY);
    set(`I${r}`, p.cumulativePct, "0%");
    set(`J${r}`, v.remaining, MONEY);
  }
  set("D17", 1, "0%");
  set("E17", p.cumulativePct, "0%");
  set("F17", p.priorPct, "0%");
  set("G17", p.stagePct, "0%");
  set("H17", p.stagePct, "0%");
  set("I17", p.cumulativePct, "0%");

  set("C19", `ҮЕ ШАТНЫ АЖЛЫН ХУВААРЬ № ${no}`);
  set("C22", `Газар чөлөөлсөн гүйцэтгэл ${input.stage}%`);
  set("H21", input.date);
  // Төлөвлөгөө — нийт үнэлгээ; гүйцэтгэл — хуримтлагдсан; тайлант үе — энэ удаагийн.
  for (const [plan, perf] of [[22, 23], [24, 25]]) {
    set(`F${plan}`, p.total.budget, MONEY);
    set(`H${plan}`, p.total.current, MONEY);
    set(`J${plan}`, p.total.budget, MONEY);
    set(`F${perf}`, p.total.cumulative, MONEY);
    set(`H${perf}`, p.total.current, MONEY);
    set(`J${perf}`, p.total.cumulative, MONEY);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
