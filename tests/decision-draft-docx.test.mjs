// Захирамжийн төслийн DOCX — тоог үгээр бичих ба хүснэгтийн харагдах байдал.
//
// Юуг шалгадаг:
//   1. Мөнгө/тооны үгийн хэлбэр (2561 → "хоёр мянга таван зуун жаран нэг", 17 → "арван долоо")
//   2. Загварын догол мөрөнд "{дүн} ({дүн үгээр}) төгрөгийг" гэж давхардалгүй буух эсэх
//   3. Хүснэгтийн бүтэц: мөрийн тоо, нүдний утга, баганын өргөн, нийт мөрийн дүн
//   4. Босоо бичлэг: нарийн 4 багана (4, 6, 7, 10) гарчиг БА өгөгдлийн мөрөндөө
//      <w:textDirection w:val="btLr"/> авсан, бусад багана авалгүй байх
//   5. tcPr дотор textDirection нь vAlign-аас ӨМНӨ байх (OOXML-ийн дараалал)
//   6. Гаралтын document.xml тагийн балансаар зөв (Word уншиж чадах) эсэх
//
// Загвар файл (`public/templates/decision_draft.docx`) байхгүй бол тест SKIP болно.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { amountToMongolianWords, numberToMongolianWords } from "../src/lib/mongolian-number.ts";
import { injectDecisionDraftCompensationRows } from "../src/lib/server/decision-draft-docx-table.ts";
import { readZipEntries, renderDocxTemplate } from "../src/lib/server/docx-template.ts";

const TEMPLATE = path.join(process.cwd(), "public", "templates", "decision_draft.docx");
const VERTICAL_GRID_COLUMNS = [3, 5, 6, 9];
const GRID = [556, 1821, 1743, 544, 1072, 646, 699, 1072, 1494, 732, 1494, 1327, 1366];
const TABLE_WIDTH = GRID.reduce((sum, w) => sum + w, 0);

const plain = (xml) =>
  xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const documentXml = async (buf) =>
  (await readZipEntries(buf)).find((e) => e.name === "word/document.xml").data.toString("utf8");

function compensationTable(xml) {
  for (const match of xml.matchAll(/<w:tbl[\s\S]*?<\/w:tbl>/g)) {
    const text = plain(match[0]);
    if (text.includes("Газар эзэмшигч") && text.includes("Нийт нөхөх олговор")) return match[0];
  }
  return null;
}

function tableRows(tableXml) {
  return Array.from(tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)).map((m) => {
    let gridStart = 0;
    const cells = Array.from(m[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)).map((c) => {
      const span = Number((c[0].match(/<w:gridSpan\b[^>]*w:val="([^"]+)"/) || [])[1] || 1);
      const cell = {
        xml: c[0],
        text: plain(c[0]),
        span,
        gridStart,
        width: Number((c[0].match(/<w:tcW\b[^>]*w:w="([^"]+)"/) || [])[1] || 0),
        vertical: /<w:textDirection w:val="btLr"\/>/.test(c[0]),
      };
      gridStart += span;
      return cell;
    });
    return { xml: m[0], text: plain(m[0]), cells };
  });
}

// XML тагийн баланс — self-closing болон <?xml?>-ийг тооцохгүйгээр стекээр шалгана.
function assertBalancedXml(xml, label) {
  const stack = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g)) {
    const [, closing, name, , selfClose] = m;
    if (closing) {
      assert.equal(stack.pop(), name, `${label}: </${name}> тааралсангүй`);
    } else if (!selfClose) {
      stack.push(name);
    }
  }
  assert.deepEqual(stack, [], `${label}: хаагдаагүй таг: ${stack.join(",")}`);
}

test("тоог монгол үгээр — аравт/зуут/мянгатын холбоосны хэлбэр", () => {
  const cases = [
    [0, "тэг"],
    [1, "нэг"],
    [3, "гурав"],
    [7, "долоо"],
    [10, "арав"],
    [17, "арван долоо"],
    [20, "хорь"],
    [21, "хорин нэг"],
    [45, "дөчин тав"],
    [60, "жар"],
    [61, "жаран нэг"],
    [98, "ерэн найм"],
    [100, "нэг зуу"],
    [105, "нэг зуун тав"],
    [110, "нэг зуун арав"],
    [500, "таван зуу"],
    [561, "таван зуун жаран нэг"],
    [999, "есөн зуун ерэн ес"],
    [1000, "нэг мянга"],
    [2561, "хоёр мянга таван зуун жаран нэг"],
    [5000, "таван мянга"],
    [17_000, "арван долоон мянга"],
    [100_000, "нэг зуун мянга"],
    [1_000_000, "нэг сая"],
    [3_400_000, "гурван сая дөрвөн зуун мянга"],
    [201_446_000, "хоёр зуун нэг сая дөрвөн зуун дөчин зургаан мянга"],
    [170_576_000, "нэг зуун далан сая таван зуун далан зургаан мянга"],
    [1_002_003, "нэг сая хоёр мянга гурав"],
    [12_000_000_000, "арван хоёр тэрбум"],
    [-2561, "хасах хоёр мянга таван зуун жаран нэг"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(numberToMongolianWords(value), expected, `${value} → ${expected}`);
  }
});

test("тоог монгол үгээр — бутархайг дугуйруулж, хүчингүй утгыг тэг болгоно", () => {
  assert.equal(numberToMongolianWords(17.4), "арван долоо");
  assert.equal(numberToMongolianWords(17.5), "арван найм");
  assert.equal(numberToMongolianWords(Number.NaN), "тэг");
  assert.equal(numberToMongolianWords(Number.POSITIVE_INFINITY), "тэг");
});

// Гэрээ/актад "... төгрөг" гэж нэр үг залгах бол ХОЛБООСНЫ хэлбэрээр төгсөнө:
// 5,000 → "таван мянган төгрөг" (харин бие даасан нь "таван мянга").
test("дүнг нэр үгтэй үгээр — холбоосны хэлбэр", () => {
  const cases = [
    [3, "гурван төгрөг"],
    [10, "арван төгрөг"],
    [17, "арван долоон төгрөг"],
    [500, "таван зуун төгрөг"],
    [2561, "хоёр мянга таван зуун жаран нэг төгрөг"],
    [5000, "таван мянган төгрөг"],
    [1_000_000, "нэг сая төгрөг"],
    [372_022_000, "гурван зуун далан хоёр сая хорин хоёр мянган төгрөг"],
  ];
  for (const [value, expected] of cases) {
    assert.equal(amountToMongolianWords(value), expected, `${value} → ${expected}`);
  }
  assert.equal(amountToMongolianWords(500, ""), "таван зуу", "нэр үг байхгүй бол бие даасан хэлбэр");
});

const templateExists = fs.existsSync(TEMPLATE);

test("хүснэгт ба текст загварт яг таарч буурна", { skip: templateExists ? false : "Загвар файл байхгүй" }, async () => {
  const template = fs.readFileSync(TEMPLATE);

  const rows = [
    {
      no: "1",
      holder: "Одонцэцэгийн Саязаяа УП06271936",
      address: "Сонгинохайрхан дүүрэг 5-р хороо",
      parcelId: "1802300810",
      areaM2: "310.43",
      rightType: "өмчлөх",
      landCertificateNo: "Г-2201000431",
      affectedAreaM2: "310.43",
      landCompensation: "107,098,350",
      assetCertificateNo: "У-2201015972",
      realEstateCompensation: "68,427,143",
      propertyCompensation: "25,920,507",
      totalCompensation: "201,446,000",
    },
    {
      no: "2",
      holder: "Бадарчийн Даваасүрэн ЧГ58092401",
      address: "Сонгинохайрхан дүүрэг 5-р хороо",
      parcelId: "1802300789",
      areaM2: "198.00",
      rightType: "өмчлөх",
      landCertificateNo: "Г-2201003491",
      affectedAreaM2: "198.00",
      landCompensation: "68,310,000",
      assetCertificateNo: "У-2201017184",
      realEstateCompensation: "77,730,557",
      propertyCompensation: "24,535,443",
      totalCompensation: "170,576,000",
    },
  ];
  const groupTitle = "Сонгинохайрхан дүүргийн 5 дугаар хорооны нутаг дэвсгэрт баригдах Гэр хорооллын дахин төлөвлөлт";

  const withRows = await injectDecisionDraftCompensationRows(Buffer.from(template), [{ title: groupTitle, rows }]);
  const amount = 372_022_000;
  const output = await renderDocxTemplate(withRows, {
    decision_draft_no: "А/123",
    year: "2026",
    month: "08",
    day: "13",
    acquisition_name: "Гэр хорооллын дахин төлөвлөлт",
    acquisitioin_name: "Гэр хорооллын дахин төлөвлөлт",
    acqiusition_name: "Гэр хорооллын дахин төлөвлөлт",
    acquisition_au1_name: "Улаанбаатар",
    acquisition_au2_name: "Сонгинохайрхан",
    acquisition_au3_name: "5 дугаар хороо",
    acquisitioin_category_name: "Гэр хорооллын дахин төлөвлөлт",
    acquisition_total_parcel: "17",
    acquisition_total_parcel_by_text: numberToMongolianWords(17),
    acquisition_decision_parcel: "2",
    acquisitioin_decision_parcel: "2",
    acquisition_decision_parcel_by_text: numberToMongolianWords(2),
    acquisition_decision_parcel_amount: "372,022,000",
    acquisitioin_decision_parcel_amount: "372,022,000",
    acquisition_decision_parcel_amount_by_text: numberToMongolianWords(amount),
    acquisitioin_decision_parcel_amount_text: numberToMongolianWords(amount),
  });

  const xml = await documentXml(output);
  assertBalancedXml(xml, "гаралтын document.xml");

  // --- 1. Догол мөрийн текст: "төгрөг" давхардахгүй, тоо нь үгээр ---
  const paragraphs = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)).map((m) => plain(m[0]));
  const countParagraph = paragraphs.find((p) => p.includes("Төслийн нөлөөлөлд өртсөн нийт"));
  assert.ok(countParagraph, "тооны догол мөр олдсонгүй");
  assert.ok(countParagraph.includes("нийт 17 (арван долоо) нэгж талбараас"), countParagraph);
  assert.ok(countParagraph.includes("2 (хоёр) нэгж талбарын өмчлөгч"), countParagraph);
  assert.ok(
    countParagraph.includes(
      "372,022,000 (гурван зуун далан хоёр сая хорин хоёр мянга) төгрөгийг",
    ),
    countParagraph,
  );
  assert.equal(
    paragraphs.filter((p) => /төгрөг\)\s*төгрөг/.test(p)).length,
    0,
    "'... төгрөг) төгрөгийг' гэж давхардсан",
  );
  assert.equal(
    paragraphs.filter((p) => /\{[a-z_]+\}/.test(p)).length,
    0,
    `сольгүй placeholder үлдсэн: ${paragraphs.filter((p) => /\{[a-z_]+\}/.test(p)).join(" | ")}`,
  );

  // --- 2. Хүснэгтийн бүтэц ---
  const table = compensationTable(xml);
  assert.ok(table, "нөхөх олговрын хүснэгт олдсонгүй");
  const trs = tableRows(table);
  // 2 гарчиг + 1 дугаарлалт + 1 хэсгийн гарчиг + 2 өгөгдөл + 1 нийт
  assert.equal(trs.length, 7);

  const headerRows = trs.slice(0, 2);
  const numberRow = trs[2];
  const titleRow = trs[3];
  const dataRows = trs.slice(4, 6);
  const totalRow = trs[6];

  assert.deepEqual(
    numberRow.cells.map((c) => c.text),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
  );
  assert.equal(titleRow.cells.length, 1);
  assert.equal(titleRow.cells[0].span, 13);
  assert.equal(titleRow.cells[0].text, groupTitle);

  dataRows.forEach((row, i) => {
    const expected = Object.values(rows[i]);
    assert.equal(row.cells.length, 13);
    assert.deepEqual(row.cells.map((c) => c.text), expected, `өгөгдлийн мөр ${i + 1}`);
  });

  assert.deepEqual(totalRow.cells.map((c) => c.text), [
    "",
    "",
    "",
    "",
    "508.43",
    "-",
    "-",
    "508.43",
    "175,408,350",
    "-",
    "146,157,700",
    "50,455,950",
    "372,022,000",
  ]);

  // --- 3. Баганын өргөн загвартай ижил хэвээр ---
  for (const [i, row] of trs.entries()) {
    const total = row.cells.reduce((sum, c) => sum + c.width, 0);
    assert.equal(total, TABLE_WIDTH, `мөр ${i}-ийн нийт өргөн зөрүүтэй`);
    for (const cell of row.cells) {
      const expected = GRID.slice(cell.gridStart, cell.gridStart + cell.span).reduce((s, w) => s + w, 0);
      assert.equal(cell.width, expected, `мөр ${i}, багана ${cell.gridStart} өргөн зөрүүтэй`);
    }
  }

  // --- 4. Босоо бичлэг: гарчиг ба өгөгдлийн мөрийн нарийн 4 багана ---
  // Гарчгийн 1-р мөрийн 7, 10-р багана нь нэгтгэсэн (span=3) толгой тул тэнд босоо
  // болгох текст байхгүй — босоо гарчгууд нь 2-р мөрөнд байна.
  const verticalByRow = [
    ["гарчиг 1", headerRows[0], [3, 5]],
    ["гарчиг 2", headerRows[1], VERTICAL_GRID_COLUMNS],
    ["өгөгдөл 1", dataRows[0], VERTICAL_GRID_COLUMNS],
    ["өгөгдөл 2", dataRows[1], VERTICAL_GRID_COLUMNS],
  ];
  for (const [label, row, expected] of verticalByRow) {
    const vertical = row.cells.filter((c) => c.vertical).map((c) => c.gridStart);
    assert.deepEqual(vertical, expected, `${label}: босоо багана таарсангүй`);
  }
  for (const [label, row] of [["дугаарлалт", numberRow], ["хэсгийн гарчиг", titleRow], ["нийт", totalRow]]) {
    assert.deepEqual(row.cells.filter((c) => c.vertical), [], `${label}: босоо болох ёсгүй`);
  }
  // Босоо нүд бүр загварын агуулгаа хадгалсан (гарчгийн текст, өгөгдлийн утга)
  assert.equal(headerRows[0].cells[3].text, "Нэгж талбарын дугаар");
  assert.equal(headerRows[0].cells[5].text, "Эдэлбэрийн хэлбэр");
  assert.equal(headerRows[1].cells.find((c) => c.gridStart === 6).text, "Гэрчилгээний дугаар");
  assert.equal(headerRows[1].cells.find((c) => c.gridStart === 9).text, "Гэрчилгээний дугаар");
  assert.equal(dataRows[0].cells[3].text, "1802300810");
  assert.equal(dataRows[0].cells[6].text, "Г-2201000431");

  // --- 5. OOXML дараалал: textDirection нь vAlign-аас өмнө, tcPr дотор ---
  for (const match of table.matchAll(/<w:tcPr>[\s\S]*?<\/w:tcPr>/g)) {
    const tcPr = match[0];
    if (!tcPr.includes("<w:textDirection")) continue;
    assert.ok(tcPr.indexOf("<w:textDirection") > tcPr.indexOf("<w:shd"), "textDirection нь shd-ээс өмнө байна");
    assert.ok(tcPr.indexOf("<w:textDirection") < tcPr.indexOf("<w:vAlign"), "textDirection нь vAlign-аас хойно байна");
    assert.equal((tcPr.match(/<w:textDirection/g) || []).length, 1, "textDirection давхардсан");
  }
  // 2 (гарчиг 1) + 4 (гарчиг 2) + 4 × 2 (өгөгдлийн мөр)
  assert.equal((table.match(/<w:textDirection w:val="btLr"\/>/g) || []).length, 14, "босоо нүдний тоо");
});

test("загварыг дахин угсрахад хуулбарлагдахгүй", { skip: templateExists ? false : "Загвар файл байхгүй" }, async () => {
  const template = fs.readFileSync(TEMPLATE);
  const row = {
    no: "1",
    holder: "Тест Тестбаяр",
    address: "Хаяг",
    parcelId: "1",
    areaM2: "1.00",
    rightType: "өмчлөх",
    landCertificateNo: "Г-1",
    affectedAreaM2: "1.00",
    landCompensation: "1",
    assetCertificateNo: "У-1",
    realEstateCompensation: "1",
    propertyCompensation: "1",
    totalCompensation: "3",
  };
  const once = await injectDecisionDraftCompensationRows(Buffer.from(template), [{ title: "Хэсэг", rows: [row] }]);
  const twice = await injectDecisionDraftCompensationRows(once, [{ title: "Хэсэг", rows: [row] }]);
  const table = compensationTable(await documentXml(twice));
  // 2 гарчиг + дугаарлалт + хэсгийн гарчиг + 1 өгөгдөл + нийт
  assert.equal(tableRows(table).length, 6, "дахин угсрахад мөр хуримтлагдсан");
  assert.equal((table.match(/<w:textDirection/g) || []).length, 10, "textDirection давхардсан");
});
