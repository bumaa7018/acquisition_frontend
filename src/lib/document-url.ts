import type { Document } from "@/types";

// Хавсралтын файл ХАМААРАХ БАЙРШЛААР хоёр өөр замаар нээгдэнэ:
//
//   • Гараар оруулсан → MinIO. `file_url` нь аль хэдийн `/api/files/<key>`
//     хэлбэрийн вэб зам тул шууд хэрэглэнэ.
//   • ГУС-аас татсан (`source_doc_id` утгатай) → эх системийн FTP/SFTP сервер.
//     `file_url` нь ВЭБ хаяг БИШ, серверийн ЗАМ (mgis/011/…/x.pdf). Түүнийг
//     <a href> дээр шууд тавьбал browser нь одоогийн хуудсанд харьцуулж
//     `/parcel/mgis/011/…pdf` болгож 404 болно. Тиймээс баримтын ID-гаар
//     `/api/source-files/…` гарцаар дуудна — тэр нь backend-ээр дамжуулж
//     FTP серверээс урсгалаар буулгана.
//
// isPdfDocument — баримт PDF эсэх.
//
// `file_type` нь хоёр хэлбэрээр ирдэг: гараар оруулсанд MIME төрөл
// ("application/pdf"), ГУС-аас татсанд өргөтгөл ("pdf"). Хоосон/танихгүй
// байвал замын өргөтгөлөөс тодорхойлно.
export function isPdfDocument(doc: Pick<Document, "file_type" | "file_url">): boolean {
  if (doc.file_type?.toLowerCase().includes("pdf")) return true;
  // Query/hash-гүй хэсгээр өргөтгөлийг харна.
  const path = (doc.file_url ?? "").split(/[?#]/)[0].toLowerCase();
  return path.endsWith(".pdf");
}

// isSourceDocument — баримт эх системээс татагдсан эсэх.
export function isSourceDocument(doc: Pick<Document, "source_doc_id">): boolean {
  return Boolean(doc.source_doc_id?.trim());
}

// documentViewUrl — ХАРАХ (browser дотор нээх) хаяг.
//
// prof=true үед мэргэжлийн байгууллагын маршрут (/prof/parcels/…) хэрэглэгдэнэ
// — тэдгээр хэрэглэгч үндсэн /parcels маршрутад хандах эрхгүй.
export function documentViewUrl(
  doc: Pick<Document, "id" | "file_url" | "source_doc_id">,
  parcelId?: string,
  opts?: { prof?: boolean },
): string {
  if (isSourceDocument(doc) && parcelId) {
    const base = `/api/source-files/${encodeURIComponent(parcelId)}/${encodeURIComponent(doc.id)}`;
    return opts?.prof ? `${base}?prof=1` : base;
  }
  return doc.file_url;
}

// documentLink — баримтыг ХЭРХЭН нээхийг шийднэ:
//
//   • PDF   → браузерт ШУУД харна (inline). `download` атрибут тавихгүй.
//   • бусад → ТАТНА (docx, xlsx, зураг г.м. браузерт харагдахгүй эсвэл
//     буруу харагддаг тул).
export function documentLink(
  doc: Pick<Document, "id" | "name" | "file_url" | "file_type" | "source_doc_id">,
  parcelId?: string,
  opts?: { prof?: boolean },
): { href: string; download?: string; view: boolean } {
  if (isPdfDocument(doc)) {
    return { href: documentViewUrl(doc, parcelId, opts), view: true };
  }
  return {
    href: documentDownloadUrl(doc, parcelId, opts),
    // MinIO-ийн файлд браузер өөрөө татахыг `download` атрибут шийднэ; эх
    // системийн файлд backend нь ?download=1-ээр attachment болгоно.
    download: doc.name,
    view: false,
  };
}

// documentDownloadUrl — ТАТАХ хаяг. Эх системийн файлд `?download=1` нэмэхэд
// backend нь Content-Disposition: attachment болгоно.
export function documentDownloadUrl(
  doc: Pick<Document, "id" | "file_url" | "source_doc_id">,
  parcelId?: string,
  opts?: { prof?: boolean },
): string {
  if (isSourceDocument(doc) && parcelId) {
    const url = documentViewUrl(doc, parcelId, opts);
    return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
  }
  return doc.file_url;
}
