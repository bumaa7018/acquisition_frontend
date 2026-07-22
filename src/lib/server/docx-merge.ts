import { readZipEntries, writeZipEntries, type ZipEntry } from "./docx-template";

const PAGE_BREAK_PARAGRAPH = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

// Зөвхөн body-ийн ХУУЛЬЧТИЙН эцсийн sectPr (шууд w:body-ийн хүү) хайхад ашиглана.
// Хэсэг доторх (жишээ нь өөр footer-той эхний хуудасны) sectPr үргэлж paragraph-ийн
// w:pPr дотор орших тул эндхийн regex үүнийг хамарч болохгүй.
const FINAL_SECT_PR = /^\s*(<w:sectPr\b[^>]*\/>|<w:sectPr\b[^>]*>[\s\S]*<\/w:sectPr>)\s*$/;

function getEntryText(entries: ZipEntry[], name: string): string | null {
  const entry = entries.find((e) => e.name === name);
  return entry ? entry.data.toString("utf8") : null;
}

function setEntry(entries: ZipEntry[], name: string, text: string): void {
  const idx = entries.findIndex((e) => e.name === name);
  const data = Buffer.from(text, "utf8");
  if (idx >= 0) entries[idx] = { ...entries[idx], data };
  else entries.push({ name, method: 8, data });
}

function extractBody(documentXml: string): { before: string; body: string; after: string } {
  const start = documentXml.indexOf("<w:body>");
  const end = documentXml.lastIndexOf("</w:body>");
  if (start === -1 || end === -1) throw new Error("DOCX word/document.xml дотор <w:body> олдсонгүй");
  return {
    before: documentXml.slice(0, start + "<w:body>".length),
    body: documentXml.slice(start + "<w:body>".length, end),
    after: documentXml.slice(end),
  };
}

// body-ийн сүүлчийн paragraph/table хаагдах тагийн ДАРААХ байрлалыг олно — зөвхөн
// энэ цэгээс хойш орших sectPr нь w:body-ийн шууд хүү (баримтын эцсийн хэсгийн
// тохиргоо) байж болно; үүнээс өмнөх аливаа sectPr нь заавал paragraph-ийн w:pPr
// дотор орших дунд хэсгийн тасалбар тул хөндөх ёсгүй.
function findBodyContentBoundary(body: string): number {
  const lastP = body.lastIndexOf("</w:p>");
  const lastTbl = body.lastIndexOf("</w:tbl>");
  const pEnd = lastP >= 0 ? lastP + "</w:p>".length : -1;
  const tblEnd = lastTbl >= 0 ? lastTbl + "</w:tbl>".length : -1;
  return Math.max(pEnd, tblEnd, 0);
}

// body-ийг [бодит агуулга] ба [баримтын эцсийн sectPr] гэж хуваана. Дундах
// section break-үүдийг (paragraph-ийн w:pPr дотор орших sectPr) хөндөхгүй.
function splitFinalSectPr(body: string): { content: string; sectPr: string } {
  const boundary = findBodyContentBoundary(body);
  const tail = body.slice(boundary);
  const match = tail.match(FINAL_SECT_PR);
  if (!match) return { content: body, sectPr: "" };
  return { content: body.slice(0, boundary), sectPr: match[1] };
}

// Хавсралт баримтын биеийн эцсийн (шууд body-ийн хүү) sectPr-ийг хасна — энэ нь
// тухайн баримтын өөрийн хуудасны тохиргоо/толгой-хөлийг зааж байгаа тул нэгтгэсэн
// баримтад орох ёсгүй (үндсэн баримтын сүүлийн sectPr хэвээрээ үлдэнэ). Дундах
// section break-үүд (хэрэв байвал) хэвээрээ үлдэнэ.
function stripTrailingSectPr(body: string): string {
  return splitFinalSectPr(body).content;
}

function remapNumbering(
  baseEntries: ZipEntry[],
  appendEntries: ZipEntry[],
  appendBody: string,
): string {
  const baseNumbering = getEntryText(baseEntries, "word/numbering.xml");
  const appendNumbering = getEntryText(appendEntries, "word/numbering.xml");
  if (!baseNumbering || !appendNumbering) return appendBody;

  const maxId = (xml: string, tag: string, attr: string) => {
    const re = new RegExp(`<w:${tag}\\s+w:${attr}="(\\d+)"`, "g");
    let max = -1;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) max = Math.max(max, Number(m[1]));
    return max;
  };

  let nextAbstractId = maxId(baseNumbering, "abstractNum", "abstractNumId") + 1;
  let nextNumId = maxId(baseNumbering, "num", "numId") + 1;

  const abstractIdMap = new Map<string, number>();
  const numIdMap = new Map<string, number>();

  const abstractBlockRe = /<w:abstractNum\s+w:abstractNumId="(\d+)"[^>]*>[\s\S]*?<\/w:abstractNum>/g;
  const newAbstractBlocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = abstractBlockRe.exec(appendNumbering))) {
    const oldId = m[1];
    const newId = nextAbstractId++;
    abstractIdMap.set(oldId, newId);
    newAbstractBlocks.push(
      m[0].replace(/(w:abstractNumId=")(\d+)(")/, `$1${newId}$3`),
    );
  }

  const numBlockRe = /<w:num\s+w:numId="(\d+)"[^>]*>[\s\S]*?<\/w:num>/g;
  const newNumBlocks: string[] = [];
  while ((m = numBlockRe.exec(appendNumbering))) {
    const oldId = m[1];
    const newId = nextNumId++;
    numIdMap.set(oldId, newId);
    let block = m[0].replace(/(w:numId=")(\d+)(")/, `$1${newId}$3`);
    block = block.replace(/(<w:abstractNumId\s+w:val=")(\d+)(")/, (full, pre, abstractOld, post) => {
      const mapped = abstractIdMap.get(abstractOld);
      return mapped != null ? `${pre}${mapped}${post}` : full;
    });
    newNumBlocks.push(block);
  }

  if (newAbstractBlocks.length === 0 && newNumBlocks.length === 0) return appendBody;

  let mergedNumbering = baseNumbering;
  const lastAbstractEnd = mergedNumbering.lastIndexOf("</w:abstractNum>");
  const abstractInsertAt = lastAbstractEnd >= 0 ? lastAbstractEnd + "</w:abstractNum>".length : mergedNumbering.indexOf(">") + 1;
  mergedNumbering =
    mergedNumbering.slice(0, abstractInsertAt) + newAbstractBlocks.join("") + mergedNumbering.slice(abstractInsertAt);

  const lastNumEnd = mergedNumbering.lastIndexOf("</w:num>");
  const numInsertAt = lastNumEnd >= 0 ? lastNumEnd + "</w:num>".length : mergedNumbering.lastIndexOf("</w:numbering>");
  mergedNumbering = mergedNumbering.slice(0, numInsertAt) + newNumBlocks.join("") + mergedNumbering.slice(numInsertAt);

  setEntry(baseEntries, "word/numbering.xml", mergedNumbering);

  return appendBody.replace(/(<w:numId\s+w:val=")(\d+)("\s*\/>)/g, (full, pre, oldId, post) => {
    const mapped = numIdMap.get(oldId);
    return mapped != null ? `${pre}${mapped}${post}` : full;
  });
}

function parseRelationships(xml: string): { id: string; attrs: string; full: string }[] {
  const re = /<Relationship\b[^>]*\/>/g;
  const result: { id: string; attrs: string; full: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const idMatch = m[0].match(/Id="([^"]+)"/);
    if (idMatch) result.push({ id: idMatch[1], attrs: m[0], full: m[0] });
  }
  return result;
}

function attrValue(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

// word/_rels/document.xml.rels дэх хавсралтын биед ашиглагдсан rId-үүдийг (зураг,
// холбоос гэх мэт) үндсэн баримт руу давхцалгүй нэрээр хуулж, ишлэлүүдийг шинэ ID рүү шилжүүлнэ.
function remapRelationshipsAndMedia(
  baseEntries: ZipEntry[],
  appendEntries: ZipEntry[],
  appendBody: string,
): string {
  const referencedIds = new Set<string>();
  const refRe = /r:(?:id|embed)="(rId\d+)"/g;
  let rm: RegExpExecArray | null;
  while ((rm = refRe.exec(appendBody))) referencedIds.add(rm[1]);
  if (referencedIds.size === 0) return appendBody;

  const appendRelsXml = getEntryText(appendEntries, "word/_rels/document.xml.rels");
  const baseRelsXml = getEntryText(baseEntries, "word/_rels/document.xml.rels");
  if (!appendRelsXml || !baseRelsXml) return appendBody;

  const appendRels = parseRelationships(appendRelsXml);
  const baseRels = parseRelationships(baseRelsXml);

  let maxRid = 0;
  for (const r of baseRels) {
    const n = Number(r.id.replace(/^rId/, ""));
    if (Number.isFinite(n)) maxRid = Math.max(maxRid, n);
  }

  const existingMediaNames = new Set(
    baseEntries.filter((e) => e.name.startsWith("word/media/")).map((e) => e.name.slice("word/media/".length)),
  );

  const ridMap = new Map<string, string>();
  const newRelationshipTags: string[] = [];
  const contentTypeExts = new Set<string>();

  for (const oldId of Array.from(referencedIds)) {
    const rel = appendRels.find((r) => r.id === oldId);
    if (!rel) continue;
    const target = attrValue(rel.attrs, "Target");
    const type = attrValue(rel.attrs, "Type");
    const targetMode = attrValue(rel.attrs, "TargetMode");
    if (!target || !type) continue;

    const newId = `rId${++maxRid}`;
    ridMap.set(oldId, newId);

    if (targetMode === "External") {
      newRelationshipTags.push(
        `<Relationship Id="${newId}" Type="${type}" Target="${target}" TargetMode="External"/>`,
      );
      continue;
    }

    const sourcePath = `word/${target.replace(/^\.?\//, "")}`;
    const sourceEntry = appendEntries.find((e) => e.name === sourcePath);
    if (!sourceEntry) continue;

    const baseName = target.split("/").pop() || target;
    const ext = baseName.includes(".") ? baseName.split(".").pop()! : "";
    let newName = baseName;
    let counter = 2;
    while (existingMediaNames.has(newName)) {
      newName = `${baseName.replace(/\.[^.]+$/, "")}_${counter}${ext ? "." + ext : ""}`;
      counter++;
    }
    existingMediaNames.add(newName);
    if (ext) contentTypeExts.add(ext.toLowerCase());

    baseEntries.push({ name: `word/media/${newName}`, method: sourceEntry.method, data: sourceEntry.data });
    newRelationshipTags.push(`<Relationship Id="${newId}" Type="${type}" Target="media/${newName}"/>`);
  }

  if (newRelationshipTags.length > 0) {
    const insertAt = baseRelsXml.lastIndexOf("</Relationships>");
    const mergedRels = baseRelsXml.slice(0, insertAt) + newRelationshipTags.join("") + baseRelsXml.slice(insertAt);
    setEntry(baseEntries, "word/_rels/document.xml.rels", mergedRels);
  }

  if (contentTypeExts.size > 0) {
    const contentTypesXml = getEntryText(baseEntries, "[Content_Types].xml");
    if (contentTypesXml) {
      const missing = Array.from(contentTypeExts).filter(
        (ext) => !new RegExp(`Extension="${ext}"`, "i").test(contentTypesXml),
      );
      if (missing.length > 0) {
        const defaultsForContentType: Record<string, string> = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          bmp: "image/bmp",
          emf: "image/x-emf",
          wmf: "image/x-wmf",
        };
        const inserts = missing
          .map((ext) => `<Default Extension="${ext}" ContentType="${defaultsForContentType[ext] || "application/octet-stream"}"/>`)
          .join("");
        const insertAt = contentTypesXml.lastIndexOf("</Types>");
        setEntry(baseEntries, "[Content_Types].xml", contentTypesXml.slice(0, insertAt) + inserts + contentTypesXml.slice(insertAt));
      }
    }
  }

  return appendBody.replace(/(r:(?:id|embed)=")(rId\d+)(")/g, (full, pre, oldId, post) => {
    const mapped = ridMap.get(oldId);
    return mapped != null ? `${pre}${mapped}${post}` : full;
  });
}

// Хоёр DOCX баримтыг нэгтгэнэ: `appendBuf`-ийн агуулгыг `baseBuf`-ийн төгсгөлд
// хуудас таслалтын дараа залгана. Тоолуурын жагсаалт (numbering), зураг/холбоос
// (rels + media) давхцахгүй байхаар дахин дугаарлагдана. Хавсралтын өөрийн эцсийн
// хуудасны тохиргоо (sectPr, толгой/хөл) хаягдаж, үндсэн баримтын тохиргоо үргэлжилнэ.
export function mergeDocx(baseBuf: Buffer, appendBuf: Buffer): Buffer {
  const baseEntries = readZipEntries(baseBuf);
  const appendEntries = readZipEntries(appendBuf);

  const baseDocXml = getEntryText(baseEntries, "word/document.xml");
  const appendDocXml = getEntryText(appendEntries, "word/document.xml");
  if (!baseDocXml || !appendDocXml) throw new Error("DOCX баримтуудаас word/document.xml олдсонгүй");

  const baseParts = extractBody(baseDocXml);
  const appendParts = extractBody(appendDocXml);

  let appendBody = stripTrailingSectPr(appendParts.body);
  appendBody = remapNumbering(baseEntries, appendEntries, appendBody);
  appendBody = remapRelationshipsAndMedia(baseEntries, appendEntries, appendBody);

  const { content: baseBodyContent, sectPr: baseSectPr } = splitFinalSectPr(baseParts.body);
  const mergedBody = baseBodyContent + PAGE_BREAK_PARAGRAPH + appendBody + baseSectPr;

  setEntry(baseEntries, "word/document.xml", baseParts.before + mergedBody + baseParts.after);

  return writeZipEntries(baseEntries);
}
