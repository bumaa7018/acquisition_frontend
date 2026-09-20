// PDF дотор ШИГТГЭСЭН JPEG зургуудыг буцаан задлах.
//
// Хөрөнгийн зургууд нь серверт НЭГ PDF болж хадгалагддаг (олон зургийг нэгтгэх,
// нэг хавсралт болгох шалтгаанаар). Дэлгэц дээр PDF үзэгчээр биш, ЗУРАГ болгон
// шууд харуулахын тулд тэдгээрийг эргүүлэн авна. Зургууд нь JPEG (DCTDecode)
// хэлбэрээр шигтгэгддэг тул stream-ийн агуулга нь бэлэн JPEG файл байдаг —
// дахин кодлох шаардлагагүй.
//
// DOM-оос хамааралгүй (node дээр тестлэгдэнэ).

import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

/** PDF-ийн байтаас JPEG зургуудыг (хуудасны дарааллаар) задална. */
export async function extractPdfJpegs(bytes: ArrayBuffer | Uint8Array): Promise<Uint8Array[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out: Uint8Array[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (String(dict.get(PDFName.of("Subtype"))) !== "/Image") continue;
    // Зөвхөн JPEG — бусад шахалт (Flate г.м) нь түүхий пиксел тул задлаад
    // <img>-д шууд өгөх боломжгүй, ийм үед дуудагч PDF-ийг өөрийг нь харуулна.
    if (String(dict.get(PDFName.of("Filter"))) !== "/DCTDecode") continue;
    out.push(obj.contents);
  }
  return out;
}
