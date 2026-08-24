import type OLMap from "ol/Map";

/**
 * OpenLayers Canvas renderer-ийн идэвхтэй харагдацыг нэг PNG зураг болгон нэгтгэж,
 * шинэ цонхонд нээгээд хэвлэх диалогийг өөрөө дуудна.
 *
 * Цонхыг ЭХЭЛЖ (rendercomplete-с ӨМНӨ) синхрон нээж байгаа нь санамсаргүй биш: попап
 * блокуудын ихэнх нь зөвхөн хэрэглэгчийн click-ийн шууд стек дотор дуудсан
 * window.open-ийг зөвшөөрдөг тул render дуустал хүлээвэл блоклогдох эрсдэлтэй.
 */
export function printOLMap(map: OLMap, title = "Газрын зураг"): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>${title}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#64748b;"><p>Зураг бэлтгэж байна...</p></body></html>`,
  );

  map.once("rendercomplete", () => {
    const size = map.getSize();
    const mapContext = document.createElement("canvas").getContext("2d");
    if (!size || !mapContext) {
      win.close();
      return;
    }
    mapContext.canvas.width = size[0];
    mapContext.canvas.height = size[1];

    Array.from(
      map.getViewport().querySelectorAll<HTMLCanvasElement>(".ol-layer canvas, canvas.ol-layer"),
    ).forEach((canvas) => {
      if (canvas.width === 0) return;
      const parent = canvas.parentElement;
      const opacityStr = parent?.style.opacity || canvas.style.opacity;
      mapContext.globalAlpha = opacityStr === "" ? 1 : Number(opacityStr);

      const match = canvas.style.transform.match(/^matrix\(([^)]*)\)$/);
      if (match) {
        const [a, b, c, d, e, f] = match[1].split(",").map(Number);
        mapContext.setTransform(a, b, c, d, e, f);
      } else {
        mapContext.setTransform(1, 0, 0, 1, 0, 0);
      }
      mapContext.drawImage(canvas, 0, 0);
    });
    mapContext.globalAlpha = 1;
    mapContext.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = mapContext.canvas.toDataURL("image/png");
    win.document.open();
    win.document.write(
      `<!doctype html><html><head><title>${title}</title><style>
        body{margin:0;display:flex;align-items:center;justify-content:center;background:#fff;}
        img{max-width:100%;height:auto;}
      </style></head><body><img src="${dataUrl}" alt="${title}" /></body></html>`,
    );
    win.document.close();
    win.document.querySelector("img")?.addEventListener("load", () => {
      win.focus();
      win.print();
    });
  });
  map.renderSync();
}
