import type OLMap from "ol/Map";
// @ts-ignore: CSS side-effect import for Cesium widgets (credit/attribution container)
import "cesium/Build/Cesium/Widgets/widgets.css";

export interface Cesium3DBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Cesium3DParcel {
  id: string;
  /** Төлөвийн код (0-5), дашбоардын v_parcel_s0..s5-тай тохирно */
  status: number;
  /** Төлөвийн өнгө, hex (жишээ нь "#22c55e") */
  color: string;
  /** Төлөвийн нэр, нэгж талбар дээр текстээр харагдана */
  statusLabel: string;
  /** Гадна талын ring, [lon, lat] градусаар */
  ring: [number, number][];
}

export interface ActivateCesium3DOptions {
  map: OLMap;
  center: { lon: number; lat: number };
  range: number;
  /** Чөлөөлөлтийн орчмын (lon/lat, градус) хязгаар — камерын pan/zoom үүгээр хаалттай */
  bounds: Cesium3DBounds;
  parcels?: Cesium3DParcel[];
  /** Төлөв тус бүрийн (0-5) анхны харагдах эсэх, LayerPanel-ийн toggle-той тохирно */
  statusVisibility?: Record<number, boolean>;
}

export interface Cesium3DHandle {
  setEnabled(enabled: boolean): void;
  setParcels(parcels: Cesium3DParcel[]): void;
  setStatusVisible(status: number, visible: boolean): void;
  destroy(): void;
}

const PARCEL_WALL_HEIGHT = 2.5;
// Энэ зайнаас цааш камер холдвол текст/шошго нуугдана (эвцэлдэхээс сэргийлнэ)
const LABEL_MAX_DISTANCE = 3000;

function ringCentroid(ring: [number, number][]): [number, number] {
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / ring.length, sumLat / ring.length];
}

function approxMetersBetween(a: [number, number], b: [number, number]): number {
  const latRad = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dLon = (b[0] - a[0]) * 111320 * Math.cos(latRad);
  const dLat = (b[1] - a[1]) * 110540;
  return Math.hypot(dLon, dLat);
}

const WALL_TARGET_SEGMENT_METERS = 40;
const WALL_MAX_SEGMENTS_PER_EDGE = 20;

// Хана (wall)-ыг зөвхөн булан цэгүүдээр (positions) босговол ирмэг бүрийг ЗУЗААН ШУГАМААР
// (straight chord) холбодог тул ирмэгүүдийн хоорондох налуу/гүдгэр газар дээр хана
// "хөндийрч" (агаарт хөвж) харагдана. Ирмэг тутмыг бодит зайд нь тохируулан олон дэд
// цэг рүү задалж, тэдгээр цэг бүрт нь тусад нь газрын өндөр авснаар хана терраны
// налууг нарийвчлалтай дагана.
function densifyRing(ring: [number, number][]): [number, number][] {
  if (ring.length < 2) return ring;
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const segments = Math.min(
      WALL_MAX_SEGMENTS_PER_EDGE,
      Math.max(1, Math.ceil(approxMetersBetween(a, b) / WALL_TARGET_SEGMENT_METERS)),
    );
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  out.push(ring[ring.length - 1]);
  return out;
}

// Нэгж талбар бүрийн гадна ирмэгийг бодит газрын гадаргуу дээр нь (terrain-clamped) 2.5м
// өндөр хашаа (wall) болгож, дунд нь төлвийн нэрийг текстээр харуулна.
// hasRealTerrain==false үед (Ion token байхгүй) газрын гадаргуу далайн түвшинтэй (0м) тэнцүү гэж үзнэ.
async function buildParcelEntities(
  Cesium: typeof import("cesium"),
  dataSource: InstanceType<typeof Cesium.CustomDataSource>,
  parcels: Cesium3DParcel[],
  terrainProvider: InstanceType<typeof Cesium.TerrainProvider>,
  hasRealTerrain: boolean,
  statusVisible: Record<number, boolean>,
) {
  dataSource.entities.removeAll();

  for (const parcel of parcels) {
    if (parcel.ring.length < 3) continue;
    const show = statusVisible[parcel.status] ?? true;

    // Ирмэг тутмыг бодит зайд нь тохируулан задалж, хана терраны налууг нарийвчлалтай дагуулна
    const denseRing = hasRealTerrain ? densifyRing(parcel.ring) : parcel.ring;
    const cartographics = denseRing.map(([lon, lat]) => Cesium.Cartographic.fromDegrees(lon, lat));
    if (hasRealTerrain) {
      try {
        await Cesium.sampleTerrainMostDetailed(terrainProvider, cartographics);
      } catch {
        // терраны өндөр авч чадаагүй бол далайн түвшнээр (0м) үргэлжлүүлнэ
      }
    }
    const groundHeights = cartographics.map((c) => c.height ?? 0);
    const positions = cartographics.map((c, i) =>
      Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, groundHeights[i]),
    );
    const color = Cesium.Color.fromCssColorString(parcel.color);
    const properties = { parcelStatus: parcel.status };

    // Талбайн гадаргууг төлвийн өнгөөр дүүргэж будна (2D-тэй адил, "аль нэгж талбар аль
    // өнгөтэйг" алсаас ялгаж харагдуулна). classificationType ашигласнаар Cesium өөрөө
    // terrain-д clamp хийдэг тул өндөр тооцоолол хийх шаардлагагүй, гулгах/хөвөх алдаагүй.
    dataSource.entities.add({
      id: `fill-${parcel.id}`,
      show,
      properties,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(parcel.ring.flat()),
        material: color.withAlpha(0.35),
        classificationType: Cesium.ClassificationType.TERRAIN,
      },
    });

    dataSource.entities.add({
      id: `wall-${parcel.id}`,
      show,
      properties,
      wall: {
        positions,
        minimumHeights: groundHeights,
        maximumHeights: groundHeights.map((h) => h + PARCEL_WALL_HEIGHT),
        material: color.withAlpha(0.75),
        outline: true,
        outlineColor: color,
      },
    });

    const avgGroundHeight = groundHeights.reduce((a, b) => a + b, 0) / groundHeights.length;
    const [centerLon, centerLat] = ringCentroid(parcel.ring);
    dataSource.entities.add({
      id: `label-${parcel.id}`,
      show,
      properties,
      position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, avgGroundHeight + PARCEL_WALL_HEIGHT),
      label: {
        text: parcel.statusLabel,
        font: "600 13px sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        showBackground: true,
        backgroundColor: color.withAlpha(0.85),
        backgroundPadding: new Cesium.Cartesian2(6, 4),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, LABEL_MAX_DISTANCE),
      },
    });
  }
}

const HIDE_CREDITS_STYLE_ID = "cesium-hide-credits";

/**
 * Cesium Scene өөрөө canvas-ийн хажууд автоматаар нэмдэг "cesium ion" лого/
 * "Data attribution" credit хэсгийг нуух — жижиг давхаргад шаардлагагүй,
 * зөвхөн 1 удаа (davхар нэмэгдэхгүй) global style тарина.
 */
function hideCesiumCredits() {
  if (document.getElementById(HIDE_CREDITS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIDE_CREDITS_STYLE_ID;
  style.textContent = `
    .cesium-credit-logoContainer, .cesium-credit-textContainer, .cesium-credit-expand-link {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * OpenLayers 2D зурагт (энд байгаа `map`) Cesium 3D globe-ийг олсы (olcs) ашиглан давхарлана.
 * Энэ файл нь 2D зураг ачаалах кодоос тусад — зөвхөн хэрэглэгч "3D" сонголтыг сонгоход л дуудагдана.
 */
export async function activateCesium3D({
  map,
  center,
  range,
  bounds,
  parcels = [],
  statusVisibility = {},
}: ActivateCesium3DOptions): Promise<Cesium3DHandle> {
  (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium";
  const [Cesium, olcsModule] = await Promise.all([import("cesium"), import("olcs")]);
  const OLCesium = olcsModule.default;
  // olcs эх код (v2.23) `Cesium`-г global хувьсагч гэж уншдаг тул module namespace-ийг window дээр буулгана
  (window as unknown as { Cesium?: typeof Cesium }).Cesium = Cesium;

  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "";
  Cesium.Ion.defaultAccessToken = ionToken;

  let terrainProvider: InstanceType<typeof Cesium.TerrainProvider>;
  if (ionToken) {
    try {
      terrainProvider = await Cesium.createWorldTerrainAsync();
    } catch {
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
  } else {
    terrainProvider = new Cesium.EllipsoidTerrainProvider();
  }

  hideCesiumCredits();

  const oc = new OLCesium({ map });
  const scene = oc.getCesiumScene();
  scene.terrainProvider = terrainProvider;
  scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b1220");
  scene.screenSpaceCameraController.enableCollisionDetection = false;
  // Гэрэлтүүлэг (hillshade) асааж терраны налууг илүү тод харуулна.
  // Санамж: verticalExaggeration-ийг ЗОРИУДААР ашиглаагүй — өндөршил хиймлээр томорвол
  // нэгж талбарын хашаа/шошго (бодит, exaggeration-гүй өндрөөр байрлуулсан) харагдах
  // терраны гадаргуутай зөрж, "агаарт хөвөх" эсвэл газар дор орох алдаа гаргадаг байсан.
  if (ionToken) {
    scene.globe.enableLighting = true;
  }

  // Чөлөөлөлтийн хилээс хэт хол зумаутлахыг хориглоно (native constraint — идэвхтэй drag/scroll-той зөрчилдөхгүй)
  const minHeight = 50;
  const maxHeight = Math.max(range * 4, 2000);
  scene.screenSpaceCameraController.minimumZoomDistance = minHeight;
  scene.screenSpaceCameraController.maximumZoomDistance = maxHeight;

  // Камер тухайн орчмын хүрээнээс (bounds) гарвал буцаан татна.
  // ЗӨВХӨН хэрэглэгчийн гар хөдөлгөөн дуусахад (moveEnd) л засна — идэвхтэй drag/zoom-ийн
  // ДУНД `camera.position`-г шууд өөрчилвөл screenSpaceCameraController-тэй зөрчилдөж,
  // камерыг газар доогуур/хүчингүй байдалд (сөрөг өндөр) шидэх алдаа гаргадаг байсан тул ингэж хийв.
  const rect = Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north);
  const clampCamera = () => {
    const camera = scene.camera;
    const carto = Cesium.Cartographic.fromCartesian(camera.positionWC);
    if (!carto) return;
    const clampedLon = Cesium.Math.clamp(carto.longitude, rect.west, rect.east);
    const clampedLat = Cesium.Math.clamp(carto.latitude, rect.south, rect.north);
    const clampedHeight = Cesium.Math.clamp(carto.height, minHeight, maxHeight * 1.2);
    if (clampedLon !== carto.longitude || clampedLat !== carto.latitude || clampedHeight !== carto.height) {
      camera.setView({
        destination: Cesium.Cartesian3.fromRadians(clampedLon, clampedLat, clampedHeight),
        orientation: { heading: camera.heading, pitch: camera.pitch, roll: camera.roll },
      });
    }
  };
  const removeClampListener = scene.camera.moveEnd.addEventListener(clampCamera);

  // Хэрэглэгч LayerPanel-ээс төлөв тус бүрийг (v_parcel_s0..s5) тусад нь идэвхжүүлэх/унтраах
  // эсрэг тал — 2D дээрх WMS toggle-той ижилхэн харагдацтай байлгахын тулд статусаар хадгална
  const statusVisible: Record<number, boolean> = { ...statusVisibility };

  const parcelDataSource = new Cesium.CustomDataSource("parcels");
  await oc.getDataSources().add(parcelDataSource);
  await buildParcelEntities(Cesium, parcelDataSource, parcels, terrainProvider, !!ionToken, statusVisible);

  oc.setEnabled(true);
  // Дээрээс шууд харсан (nadir) байдлаар биш, налуу өнцгөөр эхлүүлж 3D байдал шууд харагдахуйц болгоно
  const target = Cesium.Cartesian3.fromDegrees(center.lon, center.lat, 0);
  scene.camera.lookAt(target, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range));
  scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

  return {
    setEnabled(enabled: boolean) {
      oc.setEnabled(enabled);
    },
    setParcels(newParcels: Cesium3DParcel[]) {
      void buildParcelEntities(Cesium, parcelDataSource, newParcels, terrainProvider, !!ionToken, statusVisible);
    },
    setStatusVisible(status: number, visible: boolean) {
      statusVisible[status] = visible;
      const entities = parcelDataSource.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.properties?.parcelStatus?.getValue() === status) {
          entity.show = visible;
        }
      }
    },
    destroy() {
      removeClampListener();
      oc.getDataSources().remove(parcelDataSource, true);
      try {
        // React-ийн passive effect cleanup нь DOM-г устгасны ДАРАА ажилладаг тул
        // энд контейнер аль хэдийн 0 хэмжээтэй байх нь боломжтой. Тэгвэл Cesium-ий
        // camera.getPickRay() undefined буцааж, дараа нь "ray is required" алдаа
        // шидэгддэг (map бүхэлдээ устаж байгаа тул камерыг OL рүү sync хийх ч хамаагүй).
        oc.setEnabled(false);
      } catch {
        /* map remount/unmount үед canvas 0 хэмжээтэй байгаа тул алдааг үл хэрэгсэв */
      }
      oc.destroy();
    },
  };
}
