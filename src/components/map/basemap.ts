/**
 * Суурь зургийн OpenLayers давхарга.
 *
 * Газрын зураг бүр `createBasemapLayer()`-ээр давхарга үүсгэж, `watchBasemap()`
 * -ээр тохиргооны өөрчлөлтийг дагана (админ хаяг соливол зураг дахин
 * ачаалахгүйгээр суурь давхарга солигдоно).
 *
 * Гурван төрөл:
 *   xyz   — TileLayer + XYZ (tile сервис)
 *   wms   — ImageLayer + ImageWMS (растер зураг, дэлгэцийн хүрээгээр)
 *   image — ImageLayer + Static (тогтмол georeferenced зураг)
 */

import type OLMap from "ol/Map";
import type BaseLayer from "ol/layer/Base";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import XYZ from "ol/source/XYZ";
import ImageWMS from "ol/source/ImageWMS";
import Static from "ol/source/ImageStatic";
import { transformExtent } from "ol/proj";
import {
  DEFAULT_BASEMAP_MAX_ZOOM,
  DEFAULT_BASEMAP_URLS,
  getBasemapSetting,
  isBasemapActive,
  subscribeBasemap,
  type BasemapSetting,
} from "./basemap-config";
import { BASE_Z_INDEX } from "./layer-config";

/** Суурь давхаргыг зурган давхаргуудаас ялгах тэмдэг. */
const BASEMAP_PROP = "isBasemap";

function defaultBasemapLayer(): BaseLayer {
  return new TileLayer({
    zIndex: BASE_Z_INDEX,
    properties: { [BASEMAP_PROP]: true },
    source: new XYZ({
      urls: [...DEFAULT_BASEMAP_URLS],
      maxZoom: DEFAULT_BASEMAP_MAX_ZOOM,
      crossOrigin: "anonymous",
    }),
  });
}

/**
 * Тохиргооноос суурь давхарга үүсгэнэ. Тохируулаагүй/буруу бол ҮНДСЭН суурь зураг.
 *
 * setting-ийг өгөөгүй бол модул дахь одоогийн тохиргоо хэрэглэгдэнэ.
 */
export function createBasemapLayer(setting?: BasemapSetting | null): BaseLayer {
  const cfg = setting === undefined ? getBasemapSetting() : setting;
  if (!isBasemapActive(cfg) || !cfg) return defaultBasemapLayer();

  const attributions = cfg.attribution?.trim() ? [cfg.attribution.trim()] : undefined;

  try {
    if (cfg.type === "wms") {
      return new ImageLayer({
        zIndex: BASE_Z_INDEX,
        properties: { [BASEMAP_PROP]: true },
        source: new ImageWMS({
          url: cfg.url,
          params: { LAYERS: cfg.layer, TRANSPARENT: false },
          crossOrigin: "anonymous",
          attributions,
          ratio: 1,
        }),
      });
    }
    if (cfg.type === "image") {
      // extent нь WGS84-ээр оруулагдана; зураг нь EPSG:3857 дэлгэцэд тавигдана.
      const extent3857 = transformExtent(cfg.extent as number[], "EPSG:4326", "EPSG:3857");
      return new ImageLayer({
        zIndex: BASE_Z_INDEX,
        properties: { [BASEMAP_PROP]: true },
        source: new Static({
          url: cfg.url,
          imageExtent: extent3857,
          projection: "EPSG:3857",
          crossOrigin: "anonymous",
          attributions,
        }),
      });
    }
    // xyz
    return new TileLayer({
      zIndex: BASE_Z_INDEX,
      properties: { [BASEMAP_PROP]: true },
      source: new XYZ({
        url: cfg.url,
        maxZoom: cfg.max_zoom && cfg.max_zoom > 0 ? cfg.max_zoom : undefined,
        crossOrigin: "anonymous",
        attributions,
      }),
    });
  } catch {
    // Буруу extent/URL зэрэг үед газрын зураг ХООСОН болохоос сэргийлнэ.
    return defaultBasemapLayer();
  }
}

/** Газрын зураг дээрх суурь давхаргыг шинэ тохиргооны давхаргаар солино. */
export function applyBasemap(map: OLMap, setting?: BasemapSetting | null) {
  const layers = map.getLayers();
  const existing = layers.getArray().filter((l) => l.get(BASEMAP_PROP) === true);
  const next = createBasemapLayer(setting);
  // Шинийг ЭХЛЭЭД нэмнэ (хуучныг хасахад дэлгэц цайхгүй).
  layers.insertAt(0, next);
  existing.forEach((l) => layers.remove(l));
}

/**
 * Тохиргооны өөрчлөлтийг дагаж суурь давхаргыг солино.
 *
 * Газрын зураг үүсгэсний дараа НЭГ УДАА дуудна; буцах функцийг useEffect-ийн
 * цэвэрлэгээнд хэрэглэнэ.
 */
export function watchBasemap(map: OLMap): () => void {
  return subscribeBasemap((setting) => applyBasemap(map, setting));
}
