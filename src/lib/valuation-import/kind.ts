// Хөрөнгийн нэрнээс төрөл (үл хөдлөх / эд хөрөнгө) таамаглах логик.
// Excel-ийн "хөрөнгийн тодорхойлолт" хүснэгтэд төрлийн багана байдаггүй тул
// нэрээр нь эвристикээр ангилж, тодорхойгүй бол null буцаана (preview дээр заавал сонгоно).

import { normalizeKey } from "./normalize.ts";
import type { AssetKind } from "./types.ts";

// Үл хөдлөх хөрөнгө = үндсэн барилга/орон сууц. Зөвхөн барилгын түлхүүрүүд.
const REAL_STATE_KEYS = ["байшин", "барилга", "сууц", "ажлынбайр", "өргөтгөл", "мансард"];

// Эд хөрөнгө (Бусад хөрөнгө) = хашаа, саравч, зам, хаалга гэх мэт туслах зүйлс.
const PROPERTY_KEYS = [
  "хашаа",
  "хашлага",
  "хана",
  "агуулах",
  "амбаар",
  "граш",
  "гараж",
  "тамбар",
  "хүлэмж",
  "жорлон",
  "зам",
  "талбай",
  "хаалга",
  "худаг",
  "хайс",
  "саравч",
  "мод",
  "бут",
  "сөөг",
  "тоног",
  "төхөөрөмж",
  "тавилга",
];

/**
 * Нэрнээс хөрөнгийн төрлийг таамаглана.
 * - "газар" бол land тул энд null (мэдээллийг тусад нь боловсруулна).
 * - Тодорхойгүй бол null → preview дээр хэрэглэгч заавал сонгоно.
 */
export function detectKind(name: string): AssetKind | null {
  const k = normalizeKey(name);
  if (!k) return null;
  if (k.includes("газар")) return null; // газар нь land, хөрөнгө биш
  if (PROPERTY_KEYS.some((key) => k.includes(key))) return "property";
  if (REAL_STATE_KEYS.some((key) => k.includes(key))) return "real_state";
  return null;
}

/** Хөрөнгийн нэр "газар" мөн эсэх (land мэдээлэл рүү салгахад). */
export function isLand(name: string): boolean {
  return normalizeKey(name).startsWith("газар");
}

/** "барилга өртгийн хандлага" хамаарах барилгын мөр эсэх (нэрээр). */
export function isBuilding(name: string): boolean {
  const k = normalizeKey(name);
  return (
    k.includes("байшин") ||
    k.includes("барилга") ||
    k.includes("сууц") ||
    k.includes("ажлынбайр")
  );
}
