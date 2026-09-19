// Нөхөн олговрын үнэлгээний Excel-ийг browser дээр задлан авах модулийн төрлүүд.
// Эдгээр нь системд аль хэдийн байгаа Asset / Compensation / LandValuation
// моделтой давхцахгүй — зөвхөн parse хийсэн түр хэлбэр. Хадгалахдаа доорх
// талбаруудыг одоо байгаа entity рүү буулгана (mapper).

// Хөрөнгийн төрөл нь системийн Asset.asset_type-тэй ижил утгатай.
// "real_state" = үл хөдлөх (ҮХХ), "property" = эд хөрөнгө (ЭХ).
export type AssetKind = "real_state" | "property";

export interface ParsedOrg {
  name: string;
  stateRegNo: string; // Улсын бүртгэлийн дугаар
  regNo: string; // Регистрийн дугаар
  director: string;
  license: string; // Тусгай зөвшөөрөл
  address: string;
  contact: string;
}

export interface ParsedLand {
  ownerName: string;
  certNo: string; // Өмчлөх эрхийн улсын бүртгэлийн дугаар
  parcelNo: string; // нэгж талбарын дугаар
  affectedAreaM2: number | null; // чөлөөлөлтөнд өртсөн талбай
  basePriceM2: number | null; // 1 м² суурь үнэ
  totalValue: number | null; // газрын нийт үнэ
  description: string;
  // Шинэ загварын "Газрын эрх зүйн байдал" (Хүснэгт-2)-аас ирдэг нэмэлт мэдээлэл
  stateRegNo?: string; // улсын бүртгэлийн дугаар
  certAreaM2?: number | null; // гэрчилгээнд заасан газрын хэмжээ
  purpose?: string; // газрын зориулалт
  location?: string; // газрын байршил
}

// Үнэлгээний хүснэгт (хэсэг) бүрийн түлхүүр — ТАЙЛБАР-ыг хадгалах/харуулахад
// frontend ба backend НЭГ ижил түлхүүр ашиглана.
export type ValuationSectionKey =
  | "property_desc" // 3.1 Үнэлж буй хөрөнгүүдийн танилцуулга
  | "land_legal" // 3.2 Газрын эрх зүйн байдал
  | "land_valuation" // 3.3 Газрын үнэлгээ
  | "building_spec" // 3.4 Барилгын тодорхойлолт
  | "building_cost" // 3.5 Барилгын өртгийн хандлага
  | "other_assets" // 3.6 Бусад эд хөрөнгө
  | "temporary_cost" // 3.7 Түр суурьшуулах зардал
  | "clearance_cost" // 3.8 Газар чөлөөлөх зардал
  | "lost_income" // 3.9 Орлогын алдагдсан боломж
  | "summary" // 4.1 Хураангуй нэгтгэл
  | "conclusion" // 4.2 Дүгнэлт
  | "certification"; // 5.1 Үнэлгээний баталгаа

export const VALUATION_SECTION_KEYS: ValuationSectionKey[] = [
  "property_desc",
  "land_legal",
  "land_valuation",
  "building_spec",
  "building_cost",
  "other_assets",
  "temporary_cost",
  "clearance_cost",
  "lost_income",
  "summary",
  "conclusion",
  "certification",
];

// Хэсэг бүрийн дэлгэц дээрх нэр (тайлбарыг харуулах толгой).
export const VALUATION_SECTION_LABELS: Record<ValuationSectionKey, string> = {
  property_desc: "Үнэлж буй хөрөнгүүдийн танилцуулга",
  land_legal: "Газрын эрх зүйн байдал",
  land_valuation: "Газрын үнэлгээ",
  building_spec: "Барилгын тодорхойлолт",
  building_cost: "Барилгын өртгийн хандлага",
  other_assets: "Бусад эд хөрөнгө",
  temporary_cost: "Түр суурьшуулах зардал",
  clearance_cost: "Газар чөлөөлөх зардал",
  lost_income: "Орлогын алдагдсан боломж",
  summary: "Хураангуй нэгтгэл",
  conclusion: "Үнэлгээний дүгнэлт",
  certification: "Үнэлгээний баталгаа, хязгаарлах нөхцөл",
};

export type ValuationNotes = Partial<Record<ValuationSectionKey, string>>;

// Барилгын тодорхойлолт (Хүснэгт-4) — барилга бүрийн үзүүлэлтүүд.
export interface ParsedBuildingSpec {
  name: string; // багананы толгой (Барилга-1 г.м)
  items: { label: string; value: string }[];
}

export interface ParsedCoefficient {
  label: string;
  value: number;
}

// Барилгын өртгийн хандлагын нэг үзүүлэлтийн (мөрийн) утга.
export interface ParsedBuildingItem {
  label: string; // үзүүлэлтийн нэр (Excel-ийн "Үзүүлэлт" багана)
  group: string; // бүлгийн нэр (Итгэлцүүр г.м) — merge хийсэн row-group толгой; байхгүй бол ""
  unit: string; // хэмжих нэгж
  value: number | null; // тоон утга (задлагдвал)
  raw: string; // нүдний түүхий утга (тоон биш текст утгыг харуулахад)
}

// Барилга өртгийн хандлагаар — зөвхөн үл хөдлөх (real_state) барилгад хамаарна.
export interface ParsedBuildingCost {
  name: string; // барилгын нэр (Байшин-1 г.м) — хөрөнгийн тодорхойлолттой тааруулна
  // Хүснэгтийн БҮХ үзүүлэлтийн мөрийг ерөнхийгөөр уншина (мөр нэмэгдэхэд тэсвэртэй).
  items: ParsedBuildingItem[];
  // Доорхи талбарууд нь items-ээс гаргаж авсан (validation/хадгалалтад ашиглах хялбар лавлагаа).
  unitCostM2: number | null; // нэгж м² төсөвт өртөг
  areaM2: number | null; // барилгын талбай
  coefficients: ParsedCoefficient[]; // итгэлцүүрүүд
  replacementCost: number | null; // нөхөн орлуулах өртөг
}

export interface ParsedAsset {
  seqNo: number | null;
  name: string;
  unit: string;
  quantity: number | null; // талбай / тоо хэмжээ
  description: string;
  kind: AssetKind | null; // null бол preview дээр заавал сонгоно
  unitPrice: number | null; // Бусад хөрөнгө хүснэгтээс
  totalPrice: number | null; // тухайн хөрөнгийн нийт үнэ (нөхөн олговрын дүн)
  building?: ParsedBuildingCost; // зөвхөн барилгад
  spec?: ParsedBuildingSpec; // зөвхөн барилгад (Хүснэгт-4)
  floorCount?: number | null; // "Давхрын тоо" үзүүлэлтээс
}

// Газар чөлөөлөх / түр суурьшуулах зэрэг нэгж талбар түвшний зардал.
export interface ParsedClearance {
  category: string; // хүснэгтийн нэр (Газар чөлөөлөх, Түр суурьшуулах, ...)
  name: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export type WarningLevel = "error" | "warning";

export interface ParsedWarning {
  code: string;
  message: string;
  level: WarningLevel;
  assetSeq?: number | null; // холбогдох хөрөнгийн seq
}

export interface ParsedValuation {
  org: ParsedOrg;
  land: ParsedLand;
  assets: ParsedAsset[];
  clearance: ParsedClearance[];
  summaryTotal: number | null; // нэгтгэлийн нийт дүн (Excel-ээс)
  warnings: ParsedWarning[];
  // Логик нэр → бодит sheet нэр (fuzzy тааруулсан). Тааруулж чадаагүй бол null.
  sheetMap: Record<string, string | null>;
  // Хүснэгт бүрийн ТАЙЛБАР (шинэ загвар). Хуучин загварт хоосон.
  notes: ValuationNotes;
  // Задалсан загварын хэлбэр — preview дээр анхааруулга/дэлгэц тохируулахад.
  layout: "single-sheet" | "multi-sheet";
  conclusion: string; // 4.2 дүгнэлтийн бичвэр (байвал)
}
