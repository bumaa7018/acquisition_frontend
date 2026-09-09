"use client";

// Хэвлэх загваруудын (docx/pdf) ОРЛУУЛАХ УТГУУД — нэг эх сурвалж.
//
// Өмнө нь эдгээр нь "Эх хэвлэл" табын дотор байсан. Мэдэгдэх хуудсыг
// "Эзэмшигч" табаас PDF болгож имэйлээр илгээх болсон тул хоёр дэлгэц ИЖИЛ
// утгуудыг хэрэглэх шаардлагатай — хуулбарлавал загварын утга хоёр газар
// зөрөх эрсдэлтэй тул энд төвлөрүүлэв.

import { authStorage } from "@/lib/auth";
import { formatArea } from "@/lib/utils";
import { RIGHT_TYPE_LABELS } from "@/types";
import type { LandAcquisition, ParcelFull } from "@/types";

/** Загварын орлуулах утгууд (docx/pdf хоёуланд ижил). */
export type TemplateValues = ReturnType<typeof buildDocxTemplateValues>;

// /api/templates/* route-ууд нэвтэрсэн эсэхийг шалгадаг тул тэдгээр рүү дуудахдаа
// одоогийн хэрэглэгчийн access token-ыг дамжуулна.
export function authHeaders(): Record<string, string> {
  const token = authStorage.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function formatTemplateDate(date?: string) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatMoney(value?: number) {
  return value == null ? "" : value.toLocaleString("mn-MN");
}

export function firstLetter(value?: string) {
  return value?.trim().charAt(0) || "";
}

export function getAssignedEmployee(acquisition?: LandAcquisition) {
  const assigned = acquisition?.assigned_users?.[0];
  if (assigned?.user_name) {
    const parts = assigned.user_name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ");

    return {
      firstName,
      lastName,
      position: assigned.user_position || "",
      phone: (assigned as { phone?: string; user_phone?: string }).phone || (assigned as { user_phone?: string }).user_phone || "",
    };
  }

  const user = authStorage.getUser() as
    | { first_name?: string; last_name?: string; full_name?: string; position?: string; phone?: string; mobile?: string }
    | null;
  if (!user) return { firstName: "", lastName: "", position: "", phone: "" };

  const fullNameParts = user.full_name?.trim().split(/\s+/).filter(Boolean) || [];
  const firstName = user.first_name || fullNameParts[0] || "";
  const lastName = user.last_name || fullNameParts.slice(1).join(" ");

  return {
    firstName,
    lastName,
    position: user.position || "",
    phone: user.phone || user.mobile || "",
  };
}

export function findAdminUnitName(
  aus: LandAcquisition["aus"] | undefined,
  code: string | undefined,
  key: "au1" | "au2" | "au3"
) {
  if (!code) return "";
  const codeKey = `${key}_code` as const;
  const nameKey = `${key}_name` as const;
  const unit = aus?.find((item) => String(item[codeKey] || "") === String(code));
  return unit?.[nameKey] || "";
}

export function buildDocxTemplateValues(parcel?: ParcelFull, acquisition?: LandAcquisition) {
  const detail = parcel?.detail;
  const now = new Date();
  const assignedEmployee = getAssignedEmployee(acquisition);
  const holderName = [detail?.holder_last_name, detail?.holder_name].filter(Boolean).join(" ");
  const au = acquisition?.aus?.find((item) =>
    (!parcel?.au1_code || String(item.au1_code || "") === String(parcel.au1_code)) &&
    (!parcel?.au2_code || String(item.au2_code || "") === String(parcel.au2_code)) &&
    (!parcel?.au3_code || String(item.au3_code || "") === String(parcel.au3_code))
  );
  const au1Name = au?.au1_name || findAdminUnitName(acquisition?.aus, parcel?.au1_code, "au1");
  const au2Name = au?.au2_name || findAdminUnitName(acquisition?.aus, parcel?.au2_code, "au2");
  const au3Name = au?.au3_name || findAdminUnitName(acquisition?.aus, parcel?.au3_code, "au3");
  const address = [au1Name, au2Name, au3Name].filter(Boolean).join(" ");
  const rightType = parcel ? RIGHT_TYPE_LABELS[parcel.right_type] || "" : "";
  const compensationTotal =
    (parcel?.cash_amount ?? 0) + (parcel?.land_grant_amount ?? 0);
  const remainingArea =
    parcel?.remaining_area_m2 ?? ((parcel?.area_m2 ?? 0) - (parcel?.acquisition_area_m2 ?? 0));

  return {
    current_date: now.toLocaleDateString("mn-MN"),
    date: now.toLocaleDateString("mn-MN"),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
    city: "Улаанбаатар хот",

    acquisition_name: acquisition?.acquisition_name || "",
    acquisition_id: parcel?.acquisition_id || "",
    parcel_id: parcel?.parcel_id || "",
    old_parcel_id: parcel?.old_parcel_id || "",
    changed_parcel_id: parcel?.changed_parcel_id || "",
    landuse: parcel?.landuse || "",
    status_name: parcel?.status_name || "",
    right_type: rightType,
    right_type_label: rightType,
    parcel_right_type_name: rightType,
    area_m2: parcel?.area_m2 ?? "",
    area: formatArea(parcel?.area_m2),
    acquisition_area_m2: parcel?.acquisition_area_m2 ?? "",
    affected_area_m2: parcel?.acquisition_area_m2 ?? "",
    acquisition_area: formatArea(parcel?.acquisition_area_m2),
    remaining_area_m2: remainingArea,
    remaining_area: formatArea(remainingArea),
    address,
    au1_code: parcel?.au1_code || "",
    au2_code: parcel?.au2_code || "",
    au3_code: parcel?.au3_code || "",
    au1_name: au1Name,
    au2_name: au2Name,
    au3_name: au3Name,

    holder_name: holderName,
    full_name: holderName,
    citizen_name: holderName,
    owner_name: holderName,
    owner_lastname: detail?.holder_last_name || "",
    owner_lastname_first_spell: firstLetter(detail?.holder_last_name),
    owner_firstname: detail?.holder_name || "",
    owner_register: detail?.holder_register_no || "",
    owner_phone: detail?.holder_phone || "",
    holder_last_name: detail?.holder_last_name || "",
    holder_first_name: detail?.holder_name || "",
    holder_register_no: detail?.holder_register_no || "",
    register_no: detail?.holder_register_no || "",
    phone: detail?.holder_phone || "",
    holder_phone: detail?.holder_phone || "",
    holder_email: detail?.holder_email || "",
    holder_type: detail?.holder_type || "",
    holder_civil_id: detail?.holder_civil_id || "",

    app_no: detail?.app_no || "",
    decision_no: detail?.decision_no || "",
    decision_date: formatTemplateDate(detail?.decision_date),
    contract_no: detail?.contract_no || "",
    contract_date: formatTemplateDate(detail?.contract_date),
    certificate_no: detail?.certificate_no || "",
    building_certificate_no: detail?.certificate_no || "",
    certificate_date: formatTemplateDate(detail?.certificate_date),
    valuation_zone: detail?.valuation_zone || "",
    base_price_per_ha: formatMoney(detail?.base_price_per_ha),
    auction_coeff: detail?.auction_coeff ?? "",
    auction_price: formatMoney(detail?.auction_price),
    land_purpose: parcel?.landuse || "",
    street_name: "",
    door_number: "",
    assigned_emp_lastname_first_spell: firstLetter(assignedEmployee.lastName),
    assigned_emp_firstname: assignedEmployee.firstName,
    assigned_emp_position: assignedEmployee.position,
    assigned_emp_phone: assignedEmployee.phone,
    compansation_total_amount: formatMoney(compensationTotal),
    compensation_total_amount: formatMoney(compensationTotal),
    comensation_total_amount: formatMoney(compensationTotal),

    "овог_нэр": holderName,
    "иргэний_нэр": holderName,
    "нэгж_талбарын_дугаар": parcel?.parcel_id || "",
    "утас": detail?.holder_phone || "",
    "хаяг": address,
    "регистрийн_дугаар": detail?.holder_register_no || "",
    "талбай": formatArea(parcel?.area_m2),
    "нөлөөлөлд_өртсөн_талбай": formatArea(parcel?.acquisition_area_m2),
    "эрхийн_төрөл": rightType,
    "гэрчилгээний_дугаар": detail?.certificate_no || "",
  };
}
