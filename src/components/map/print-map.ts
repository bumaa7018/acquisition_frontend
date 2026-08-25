import type OLMap from "ol/Map";
import { PDFDocument } from "pdf-lib";

export interface PrintLegendItem {
  color: string;
  label: string;
}

export type PrintOrientation = "landscape" | "portrait";

// A4-ийн харьцаагаар px хэмжээ (~96dpi) — урьдчилан харах зураг болон PDF хуудас хоёул
// ижил харьцаатай байхын тулд газрын зургийн canvas-ыг эндхи хэмжээнд "contain" байдлаар зурна.
const A4_PX = { width: 794, height: 1123 };

function pageSizePx(orientation: PrintOrientation): { width: number; height: number } {
  return orientation === "landscape"
    ? { width: A4_PX.height, height: A4_PX.width }
    : { width: A4_PX.width, height: A4_PX.height };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * OpenLayers Canvas renderer-ийн идэвхтэй харагдацыг нэг canvas зураг болгон нэгтгэнэ.
 * rendercomplete хүлээх шаардлагатай тул Promise буцаана.
 */
export function captureMapCanvas(map: OLMap): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    map.once("rendercomplete", () => {
      const size = map.getSize();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!size || !ctx) {
        resolve(null);
        return;
      }
      canvas.width = size[0];
      canvas.height = size[1];

      Array.from(
        map.getViewport().querySelectorAll<HTMLCanvasElement>(".ol-layer canvas, canvas.ol-layer"),
      ).forEach((layerCanvas) => {
        if (layerCanvas.width === 0) return;
        const parent = layerCanvas.parentElement;
        const opacityStr = parent?.style.opacity || layerCanvas.style.opacity;
        ctx.globalAlpha = opacityStr === "" ? 1 : Number(opacityStr);

        const match = layerCanvas.style.transform.match(/^matrix\(([^)]*)\)$/);
        if (match) {
          const [a, b, c, d, e, f] = match[1].split(",").map(Number);
          ctx.setTransform(a, b, c, d, e, f);
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        ctx.drawImage(layerCanvas, 0, 0);
      });
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      resolve(canvas);
    });
    map.renderSync();
  });
}

/**
 * Гарчиг, газрын зураг, таних тэмдэг (легенд)-ийг А4 харьцаатай нэг хуудсан зураг болгож
 * зурна — энэ нь урьдчилан харах модал болон PDF-д адилхан ашиглагдана.
 */
export function composePrintPage(
  mapCanvas: HTMLCanvasElement,
  title: string,
  orientation: PrintOrientation,
  legend: PrintLegendItem[],
): HTMLCanvasElement {
  const { width, height } = pageSizePx(orientation);
  const page = document.createElement("canvas");
  page.width = width;
  page.height = height;
  const ctx = page.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const margin = 24;
  const titleAreaH = 40;

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.toUpperCase(), width / 2, margin + titleAreaH / 2);

  const mapAreaX = margin;
  const mapAreaY = margin + titleAreaH;
  const mapAreaW = width - margin * 2;
  const mapAreaH = height - mapAreaY - margin;

  // "cover" байдлаар зурна — mapArea-г бүхэлд нь дүүргэж, хэтэрсэн хэсгийг тайрна
  // (Math.min биш Math.max), учир нь зурган дээрх шиг газрын зураг хуудсыг бүрэн дүүргэсэн
  // харагдацтай байх ёстой, хоосон захтай "contain" биш.
  const scale = Math.max(mapAreaW / mapCanvas.width, mapAreaH / mapCanvas.height);
  const drawW = mapCanvas.width * scale;
  const drawH = mapCanvas.height * scale;
  const drawX = mapAreaX + (mapAreaW - drawW) / 2;
  const drawY = mapAreaY + (mapAreaH - drawH) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapAreaX, mapAreaY, mapAreaW, mapAreaH);
  ctx.clip();
  ctx.drawImage(mapCanvas, drawX, drawY, drawW, drawH);
  ctx.restore();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(mapAreaX + 0.5, mapAreaY + 0.5, mapAreaW, mapAreaH);

  if (legend.length) {
    const rowH = 18;
    const legendW = 170;
    const legendH = 30 + legend.length * rowH;
    const legendX = mapAreaX + 10;
    const legendY = mapAreaY + mapAreaH - legendH - 10;

    ctx.fillStyle = "rgba(255,255,255,0.94)";
    drawRoundedRect(ctx, legendX, legendY, legendW, legendH, 6);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Таних тэмдэг", legendX + 10, legendY + 9);

    ctx.font = "11px sans-serif";
    legend.forEach((item, i) => {
      const rowY = legendY + 30 + i * rowH;
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX + 10, rowY + 1, 12, 12);
      ctx.fillStyle = "#334155";
      ctx.fillText(item.label, legendX + 28, rowY + 1);
    });
  }

  return page;
}

/**
 * Урьдчилан бэлдсэн хуудасны canvas-ыг A4 хэмжээтэй PDF болгож татаж авна.
 */
export async function downloadCanvasAsPdf(
  canvas: HTMLCanvasElement,
  orientation: PrintOrientation,
  fileName = "gazriin-zurag",
): Promise<void> {
  const pngBytes = await fetch(canvas.toDataURL("image/png")).then((r) => r.arrayBuffer());

  const A4_PT = { width: 595.28, height: 841.89 };
  const pageSize = orientation === "landscape" ? { width: A4_PT.height, height: A4_PT.width } : A4_PT;

  const pdfDoc = await PDFDocument.create();
  const png = await pdfDoc.embedPng(pngBytes);
  const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
  page.drawImage(png, { x: 0, y: 0, width: pageSize.width, height: pageSize.height });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
