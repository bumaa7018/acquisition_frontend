import { deflateRawSync, inflateRawSync } from "zlib";

export type ZipEntry = {
  name: string;
  method: number;
  data: Buffer;
};

// Задлагдсан (decompressed) хэсэг бүрт болон нийт баримтад тавих дээд хэмжээ —
// zip-bomb (жижиг файл боловч задлахад асар их санах ой шаарддаг) халдлагаас
// хамгаална. Бодит DOCX хэсэг (жишээ нь word/document.xml, зураг г.м) эдгээр
// хэмжээнээс хэтрэхгүй тул аюулгүйн зохистой дээд хязгаар.
const MAX_ENTRY_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
const MAX_ZIP_ENTRY_COUNT = 2000;

const XML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const XML_UNESCAPE: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c >>> 0;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, zip.length - 0xffff - 22);
  for (let offset = zip.length - 22; offset >= minOffset; offset--) {
    if (zip.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error("DOCX zip бүтэц уншигдсангүй");
}

export function readZipEntries(zip: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocd + 10);
  if (entryCount > MAX_ZIP_ENTRY_COUNT) {
    throw new Error("DOCX файлд хэт олон дотоод файл байна");
  }
  let centralOffset = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  let totalUncompressed = 0;

  for (let i = 0; i < entryCount; i++) {
    if (zip.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error("DOCX central directory буруу байна");
    }

    const method = zip.readUInt16LE(centralOffset + 10);
    const compressedSize = zip.readUInt32LE(centralOffset + 20);
    const uncompressedSize = zip.readUInt32LE(centralOffset + 24);
    const nameLength = zip.readUInt16LE(centralOffset + 28);
    const extraLength = zip.readUInt16LE(centralOffset + 30);
    const commentLength = zip.readUInt16LE(centralOffset + 32);
    const localOffset = zip.readUInt32LE(centralOffset + 42);
    const name = zip.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString("utf8");

    // Zip-bomb хамгаалалт: төвийн лавлахад мэдэгдсэн задлагдсан хэмжээгээр
    // урьдчилан шалгаж, бодит decompress (inflateRawSync)-оос ӨМНӨ татгалзана.
    if (uncompressedSize > MAX_ENTRY_UNCOMPRESSED_SIZE) {
      throw new Error(`DOCX дотоод файл хэт том байна: ${name}`);
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_SIZE) {
      throw new Error("DOCX файлын нийт хэмжээ хэт том байна");
    }

    if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`DOCX local header буруу байна: ${name}`);
    }

    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) {
      // maxOutputLength нь zip төвийн лавлахад мэдэгдсэн хэмжээ худал байсан ч
      // (эвдэрсэн/дайсагнасан zip) бодит decompress-ийг давхар хязгаарлана.
      data = inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY_UNCOMPRESSED_SIZE });
    } else throw new Error(`DOCX zip compression дэмжигдэхгүй байна: ${method}`);

    entries.push({ name, method, data });
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function writeZipEntries(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.method === 0 ? entry.data : deflateRawSync(entry.data);
    const method = entry.method === 0 ? 0 : 8;
    const crc = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, eocd]);
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => XML_ESCAPE[ch]);
}

function unescapeXml(value: string): string {
  return value.replace(/&([^;]+);/g, (match, entity: string) => {
    if (XML_UNESCAPE[entity]) return XML_UNESCAPE[entity];
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return match;
  });
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function replacePlaceholdersInXml(xml: string, values: Record<string, string>): string {
  const nodes: { start: number; end: number; text: string; from: number; to: number }[] = [];
  const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let combined = "";
  let match: RegExpExecArray | null;

  while ((match = textRegex.exec(xml))) {
    const rawText = match[1];
    const text = unescapeXml(rawText);
    const start = combined.length;
    combined += text;
    nodes.push({
      start,
      end: start + text.length,
      text,
      from: match.index + match[0].indexOf(rawText),
      to: match.index + match[0].indexOf(rawText) + rawText.length,
    });
  }

  if (nodes.length === 0) return xml;

  const replacements: { start: number; end: number; value: string }[] = [];
  const placeholderRegex = /\{([^{}\]]+)[}\]]/g;
  while ((match = placeholderRegex.exec(combined))) {
    const key = normalizeKey(match[1]);
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      replacements.push({ start: match.index, end: match.index + match[0].length, value: values[key] });
    }
  }

  for (const replacement of replacements.reverse()) {
    const affected = nodes.filter((node) => node.start < replacement.end && node.end > replacement.start);
    if (affected.length === 0) continue;

    affected.forEach((node, idx) => {
      const localStart = Math.max(0, replacement.start - node.start);
      const localEnd = Math.min(node.end - node.start, replacement.end - node.start);
      const before = node.text.slice(0, localStart);
      const after = node.text.slice(localEnd);

      if (idx === 0) {
        node.text = before + replacement.value + (affected.length === 1 ? after : "");
      } else if (idx === affected.length - 1) {
        node.text = after;
      } else {
        node.text = "";
      }
    });
  }

  let result = xml;
  for (const node of [...nodes].reverse()) {
    result = result.slice(0, node.from) + escapeXml(node.text) + result.slice(node.to);
  }

  return result;
}

export function renderDocxTemplate(input: Buffer, rawValues: Record<string, unknown>): Buffer {
  const values = Object.fromEntries(
    Object.entries(rawValues).map(([key, value]) => [normalizeKey(key), value == null ? "" : String(value)]),
  );

  const entries = readZipEntries(input).map((entry) => {
    if (!entry.name.startsWith("word/") || !entry.name.endsWith(".xml")) return entry;
    const xml = entry.data.toString("utf8");
    return { ...entry, data: Buffer.from(replacePlaceholdersInXml(xml, values), "utf8") };
  });

  return writeZipEntries(entries);
}
