/**
 * Хэвлэх цонхнуудын ДУНДЫН давхаргын тохиргоо — "Ажлын зураг"
 * (print-map-dialog) ба нэгж талбарын "Трас зураг" (trace-print-dialog)
 * хоёулаа эндээс уншина. Хоёр газар тусад нь бичвэл хэвлэх style,
 * дараалал чимээгүйхэн зөрнө.
 */

/**
 * Хэвлэх суурь — ХИЙМЭЛ ДАГУУЛЫН зураг. Дэлгэцийн тохируулсан суурь зураг
 * биш: хэвлэмэл нь тохиргооноос үл хамааран ижил харагдах ёстой.
 */
export const PRINT_SATELLITE_URLS = [0, 1, 2, 3].map((i) => `https://mt${i}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`);
export const PRINT_SATELLITE_MAX_ZOOM = 20;

// Нэгж талбарын ТӨЛӨВҮҮД нь `parcel_status` бүртгэлээс ирнэ
// (`useParcelStatusLayers`). Хилийн давхаргууд нь тогтмол.
export const PRINT_BOUNDARY_IDS = ["v_acquisition_plan", "v_plan_acquisition", "au1", "au2", "au3"] as const;

// Хэвлэхэд зориулсан style-ууд (GeoServer дээр make config-оор ачаалагдана)
export const PRINT_STYLES: Record<string, string> = {
  au1: "au1_boundary_print",
  au2: "au2_boundary_print",
  au3: "au3_boundary_print",
  v_acquisition_plan: "acquisition_plan_print",
  v_plan_acquisition: "plan_acquisition_print",
};

/**
 * Төлөвийн давхаргуудын хэвлэх ГАНЦ загвар.
 *
 * Өмнө нь төлөв бүрд тусдаа (`parcel_s0_print` … `parcel_s5_print`) байсан
 * тул шинэ төлөв нэмэхэд хэвлэх зураг дээр ОГТ гарч ирдэггүй байв. Одоо ганц
 * загвар бөгөөд өнгийг нь давхаргын `color` баганаас (эх нь `parcel_status`
 * хүснэгт) SLD өөрөө уншина — эндээс дамжуулах шаардлагагүй.
 */
export const PARCEL_STATUS_PRINT_STYLE = "parcel_status_print";
