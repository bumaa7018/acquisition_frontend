import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";

import { extractPdfJpegs } from "../src/lib/pdf-images.ts";

// 1×1 пикселийн JPEG (хамгийн бага бодит JPEG файл)
// Анхаар: Node-ийн Buffer нь ХУВААЛЦСАН pool дээр суудаг тул pdf-lib түүнийг
// (byteOffset-гүй DataView-ээр) буруу уншина — өөрийн ArrayBuffer-тэй хуулбар өгнө.
const TINY_JPEG = new Uint8Array(Buffer.from(
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAqADAAQAAAABAAAAAgAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAgACAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8Az/Dv/Iv6Z/16w/8AoArYrH8O/wDIv6Z/16w/+gCtiv5XPcP/2Q==",
  "base64",
));

/** asset_photo_upload.tsx-тэй ижил зарчмаар: зургуудыг PDF хуудас болгож шигтгэнэ. */
async function buildPhotoPdf(count) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const img = await doc.embedJpg(TINY_JPEG);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return doc.save();
}

test("extractPdfJpegs: хадгалсан зургуудыг PDF-ээс буцаан задална", async () => {
  const pdf = await buildPhotoPdf(3);
  const images = await extractPdfJpegs(pdf);
  assert.equal(images.length, 3, "3 зураг задрах ёстой");
  // Задарсан байт нь ЯГ JPEG файл (SOI/EOI маркертай) байх ёстой — <img>-д шууд өгнө
  for (const img of images) {
    assert.equal(img[0], 0xff);
    assert.equal(img[1], 0xd8);
    assert.equal(img[img.length - 2], 0xff);
    assert.equal(img[img.length - 1], 0xd9);
  }
});

test("extractPdfJpegs: зураггүй PDF дээр хоосон буцаана (PDF үзэгчээр харуулна)", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]).drawText("no image");
  const images = await extractPdfJpegs(await doc.save());
  assert.deepEqual(images, []);
});
