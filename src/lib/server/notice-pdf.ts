// Урьдчилан мэдэгдэх хуудсын PDF (сервер тал).
//
// Агуулга нь `public/templates/medegdeh_huudas.docx`-ийн ЯГ ИЖИЛ үг хэллэг,
// ижил орлуулах талбарууд (year/month/day, au2_name, au3_name, owner_name,
// parcel_id, assigned_emp_*) — зөвхөн үүсгэх арга нь өөр (pdfmake).
//
// pdfmake-ийн фонт (Roboto) нь vfs дотор base64-ээр ирдэг тул диск дээрх
// нэмэлт фонт файл шаардахгүй; монгол кирилл (Ө ө Ү ү) бүрэн дэмжигдэнэ.

import type { TDocumentDefinitions } from "pdfmake/interfaces";

type NoticeValues = Record<string, unknown>;

// pdfmake-ийн NODE тал (`src/printer.js`) нь @types/pdfmake-д ороогүй (тэр нь
// зөвхөн browser-ийн createPdf-ийг тайплдаг) тул хэрэглэдэг гэрээг л
// тодорхойлно.
type PdfKitDocument = {
  on(event: "data", cb: (chunk: Buffer) => void): void;
  on(event: "end", cb: () => void): void;
  on(event: "error", cb: (err: unknown) => void): void;
  end(): void;
};
type FontFaces = { normal: Buffer; bold: Buffer; italics: Buffer; bolditalics: Buffer };
type NodePrinter = { createPdfKitDocument(def: TDocumentDefinitions): PdfKitDocument };
type NodePrinterCtor = new (fonts: Record<string, FontFaces>) => NodePrinter;

function text(values: NoticeValues, key: string, fallback = ""): string {
  const v = values[key];
  const s = v == null ? "" : String(v).trim();
  return s || fallback;
}

let printerCache: NodePrinter | null = null;

async function getPrinter(): Promise<NodePrinter> {
  if (printerCache) return printerCache;
  const printerModule = (await import("pdfmake")) as unknown as {
    default: NodePrinterCtor;
  };
  // vfs_fonts-ийн экспорт нь хувилбараас хамаарч `vfs` эсвэл `pfs` байдаг.
  const vfsModule = (await import("pdfmake/build/vfs_fonts.js")) as unknown as {
    default?: Record<string, string> & { vfs?: Record<string, string>; pfs?: Record<string, string> };
    vfs?: Record<string, string>;
    pfs?: Record<string, string>;
  };
  const base = vfsModule.default ?? vfsModule;
  const store = (base.vfs ?? base.pfs ?? base) as Record<string, string>;
  const font = (name: string) => Buffer.from(store[name], "base64");

  const PdfPrinter = printerModule.default;
  printerCache = new PdfPrinter({
    Roboto: {
      normal: font("Roboto-Regular.ttf"),
      bold: font("Roboto-Medium.ttf"),
      italics: font("Roboto-Italic.ttf"),
      bolditalics: font("Roboto-MediumItalic.ttf"),
    },
  });
  return printerCache;
}

/** Мэдэгдэх хуудсын PDF-ийг үүсгэж байт болгож буцаана. */
export async function buildNoticePdf(values: NoticeValues): Promise<Uint8Array> {
  const year = text(values, "year");
  const month = text(values, "month");
  const day = text(values, "day");
  const au2 = text(values, "au2_name", ".....");
  const au3 = text(values, "au3_name", ".....");
  const owner = text(values, "owner_name") || text(values, "holder_name", "..........");
  const parcelID = text(values, "parcel_id", "..........");
  const empSpell = text(values, "assigned_emp_lastname_first_spell");
  const empFirst = text(values, "assigned_emp_firstname");
  const empPhone = text(values, "assigned_emp_phone", "..........");
  const employee = [empSpell ? `${empSpell}.` : "", empFirst].join("").trim() || "..........";

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [64, 40, 52, 32],
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.18 },
    content: [
      // Тушаалын хавсралтын тэмдэглэл — баруун дээд булан
      {
        text: [
          "Нийслэлийн Газар зохион байгуулалтын албаны\n",
          "даргын 2019 оны 10 дугаар сарын 23-ны өдрийн\n",
          "А/84 дүгээр тушаалын нэгдүгээр хавсралт",
        ],
        alignment: "right",
        fontSize: 9,
        margin: [0, 0, 0, 18],
      },
      { text: "УРЬДЧИЛАН МЭДЭГДЭХ ХУУДАС", bold: true, alignment: "center", fontSize: 12 },
      {
        columns: [
          { text: `${year} оны ${month} сарын ${day} өдөр`, fontSize: 10 },
          { text: "Улаанбаатар хот", alignment: "right", fontSize: 10 },
        ],
        margin: [0, 14, 0, 2],
      },
      { text: `№ ${year}/`, fontSize: 10, margin: [0, 0, 0, 14] },
      {
        text: `${au2} дүүргийн ${au3} дугаар хорооны иргэн ${owner} Танаа`,
        bold: true,
        margin: [0, 0, 0, 12],
      },
      {
        text:
          `${au2} дүүргийн ${au3} дугаар хорооны нутаг дэвсгэрт ______ орчим ` +
          `_________ дугаар гудамж, гэр хорооллын дахин төлөвлөлтийн ажлыг улс, ` +
          `нийслэлийн төсвийн хөрөнгөөр хийгдэхээр бэлтгэл ажил хангагдаж байна.`,
        alignment: "justify",
        margin: [0, 0, 0, 8],
      },
      {
        text:
          `Тус ажлын нөлөөлөлд таны ${au2} дүүргийн ${au3} дугаар хорооны нутаг ` +
          `дэвсгэр дэх ${parcelID} нэгж талбарын дугаар бүхий өмчийн/эзэмшлийн газар ` +
          `өртсөнийг Захиргааны Ерөнхий хуулийн 26 дугаар зүйлийн дагуу мэдэгдэж байна.`,
        alignment: "justify",
        margin: [0, 0, 0, 8],
      },
      {
        text:
          `Энэхүү бүтээн байгуулалтын ажилд таны оролцоо, дэмжлэг шаардлагатай байгаа ` +
          `тул ${year} оны ${month}-р сарын ${day}-ны өдрийн дотор Хан-Уул дүүргийн 23 ` +
          `дугаар хороо Яармаг, Хангарди ордны Б блок 3 давхарын 314 тоотод байрлах ` +
          `Нийслэлийн Газар зохион байгуулалтын албаны Газар чөлөөлөх нэгдүгээр хэлтэст ` +
          `өөрийн биеэр ирж уулзана уу.`,
        alignment: "justify",
        margin: [0, 0, 0, 8],
      },
      {
        text:
          "Бүрдүүлэх материал: Иргэний үнэмлэх, ААН-н улсын бүртгэлийн гэрчилгээ, " +
          "үйл ажиллагаа явуулах тусгай зөвшөөрөл, газар эзэмших, өмчлөх эрхийн гэрээ " +
          "гэрчилгээ, кадастрын зураг, газрын төлбөр төлсөн баримт, үл хөдлөх хөрөнгийн " +
          "гэрчилгээ.",
        alignment: "justify",
        margin: [0, 0, 0, 8],
      },
      {
        text:
          "Мөн Монгол Улсын иргэнд газар өмчлүүлэх тухай хуулийн 37 дугаар зүйлийн 37.4 " +
          "дэх хэсэгт заасны дагуу тус мэдэгдлийг хүлээн авсан өдрөөс хойш барьсан үл " +
          "хөдлөх эд хөрөнгө, бусад арга хэмжээний зардлыг нөхөх олговорт олгохгүйг " +
          "анхааруулж байна.",
        alignment: "justify",
        margin: [0, 0, 0, 8],
      },
      {
        text:
          `Танд уг асуудлаар холбогдох дэлгэрэнгүй мэдээлэл, зөвлөгөөг Нийслэлийн Газар ` +
          `зохион байгуулалтын албаны Газар чөлөөлөх нэгдүгээр хэлтсийн газар зохион ` +
          `байгуулагч ${employee} өгөх болно. Утас:11325484, гар утас: ${empPhone}`,
        alignment: "justify",
        margin: [0, 0, 0, 8],
      },
      {
        text:
          "Нийслэл хотынхоо хөгжил цэцэглэлт, бүтээн байгуулалтад үнэтэй хувь нэмэр " +
          "оруулж буй ИХ ХОТЫН ИРГЭН танд баярлалаа.",
        alignment: "justify",
        margin: [0, 0, 0, 16],
      },
      {
        columns: [
          { text: "ДАРГА", bold: true },
          { text: "Г.МӨНХБААТАР", bold: true, alignment: "center" },
        ],
        margin: [0, 0, 0, 18],
      },
      // Хүлээн авсан тасалбар — docx-ийн 2 дугаар хэсэг
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 470, y2: 0, dash: { length: 4 }, lineWidth: 0.7 }],
        margin: [0, 0, 0, 14],
      },
      {
        text: "УРЬДЧИЛАН МЭДЭГДЭХ ХУУДАС ХҮЛЭЭН АВСАН ТАСАЛБАР",
        bold: true,
        alignment: "center",
        fontSize: 11,
        margin: [0, 0, 0, 12],
      },
      {
        columns: [
          { text: "Улаанбаатар хот", fontSize: 10 },
          { text: `${year} оны ...  сарын .... өдөр`, alignment: "right", fontSize: 10 },
        ],
        margin: [0, 0, 0, 2],
      },
      { text: `№ ${year}/`, fontSize: 10, margin: [0, 0, 0, 12] },
      { text: "Мэдэгдлийг хүлээн авсан иргэний овог, нэр: __________________________________", margin: [0, 0, 0, 8] },
      { text: "Нэгж талбарын дугаар: ____________________________________________________", margin: [0, 0, 0, 8] },
      { text: "Хаяг, утасны дугаар: ______________________________________________________", margin: [0, 0, 0, 8] },
      { text: "Гарын үсэг: ______________________________________________________________", margin: [0, 0, 0, 8] },
      { text: "Тайлбар: ________________________________________________________________" },
    ],
  };

  const printer = await getPrinter();
  return new Promise<Uint8Array>((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(doc);
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}
