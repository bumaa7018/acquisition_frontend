export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  code: number;
  data: T[];
  message: string;
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface User {
  id: string;
  username?: string;
  email: string;
  full_name?: string;
  first_name: string;
  last_name: string;
  position?: string;
  roles: Role[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
}

export interface Plan {
  id?: string;
  plan_code: string;
  name: string;
  area_m2?: number;
  status?: number;
  boundary_wkt?: string;
}

export interface ConstructionType {
  id: number;
  code: string;
  name: string;
  sort_order: number;
}

export interface AcquisitionCategory {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
}

export interface AcquisitionProgressStatus {
  id: number;
  name: string;
  description?: string;
  sort_order?: number;
}

export interface DocumentType {
  id: number;
  type: string;
  name: string;
  target: 'acquisition' | 'parcel' | 'both';
  description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface AcquisitionAssignee {
  user_id: string;
  user_name: string;
  user_position?: string;
  assigned_by: string;
  assigned_by_name: string;
  assigned_at: string;
}

export interface FundingSource {
  id: string;
  acquisition_id: string;
  organization_name: string;
  source_type: string;
  amount?: number;
  currency?: string;
  note?: string;
  created_at: string;
  created_by?: string;
}

export interface LandAcquisition {
  id: string;
  plan_code: string;
  plan_name: string;
  geometry_wkt: string;
  area_m2: number;
  status: number;
  start_date?: string;
  end_date?: string;
  acquisition_name: string;
  implementing_org: string;
  reason: string;
  responsible_org: string;
  funding_source: string;
  general_category_id?: number;
  general_category_name: string;
  sub_category_id?: number;
  sub_category_name: string;
  decree_number: string;
  decree_date?: string;
  created_at: string;
  created_by: string;
  parcel_count: number;
  aus: AU[];
  parcels?: Parcel[];
  assigned_users?: AcquisitionAssignee[];
  // Professional org assigned to perform the primary valuation
  professional_org_id?: string;
  professional_org_name?: string;
}

export interface AU {
  au1_code: string;
  au1_name: string;
  au2_code: string;
  au2_name: string;
  au3_code: string;
  au3_name: string;
}

export const RIGHT_TYPE_LABELS: Record<number, string> = {
  1: "Ашиглах",
  2: "Эзэмших",
  3: "Өмчлөх",
};

export interface ParcelStatus {
  id: number;
  code: string;
  name: string;
  sort_order: number;
}

export const PARCEL_STATUS_STYLES: Record<
  number,
  { color: string; bg: string }
> = {
  0: { color: "#64748b", bg: "#64748b1f" }, // Хүлээгдэж буй — саарал
  1: { color: "#eab308", bg: "#eab3081f" }, // Зөвшилцөх шатандаа — шар
  2: { color: "#f97316", bg: "#f973161f" }, // Үнэлгээ хийх — улбар шар
  3: { color: "#ec4899", bg: "#ec48991f" }, // Нөлөөлөгдсөн гарсан — ягаан
  4: { color: "#ef4444", bg: "#ef44441f" }, // Татгалзсан — улаан
  5: { color: "#22c55e", bg: "#22c55e1f" }, // Чөлөөлсөн — ногоон
};

export const PARCEL_STATUS_NAME_STYLES: Record<
  string,
  { color: string; bg: string }
> = {
  "Хүлээгдэж буй": PARCEL_STATUS_STYLES[0],
  "Зөвшилцөх шатандаа": PARCEL_STATUS_STYLES[1],
  "Үнэлгээ хийх": PARCEL_STATUS_STYLES[2],
  "Нөлөөлөгдсөн гарсан": PARCEL_STATUS_STYLES[3],
  Татгалзсан: PARCEL_STATUS_STYLES[4],
  Чөлөөлсөн: PARCEL_STATUS_STYLES[5],
};

export function getParcelStatusStyle(status?: number, statusName?: string) {
  return (
    (statusName && PARCEL_STATUS_NAME_STYLES[statusName]) ||
    (status !== undefined && PARCEL_STATUS_STYLES[status]) ||
    PARCEL_STATUS_STYLES[0]
  );
}

export interface Parcel {
  id: string;
  parcel_id: string;
  au1_code: string;
  au2_code: string;
  au3_code: string;
  right_type: number;
  status: number;
  status_name: string;
  landuse: string;
  area_m2: number;
  acquisition_area_m2: number;
  remaining_area_m2?: number;
  compensation_paid: boolean;
  db_changed: boolean;
  changed_parcel_id: string;
  geometry_wkt?: string;
  independent_org_id?: string;
  independent_org_name?: string;
}

export interface StatusOption {
  id: number;
  label: string;
}

export interface AcquisitionProgress {
  id: string;
  from_status: number;
  to_status: number;
  note: string;
  changed_by: string;
  changed_at: string;
}

export interface BoundaryHistory {
  id: string;
  land_acquisition_id: string;
  old_geometry_wkt: string;
  new_geometry_wkt: string;
  changed_by: string;
  changed_at: string;
}

export interface Document {
  id: string;
  name: string;
  file_type: string;
  file_url: string;
  size_bytes: number;
  note: string;
  uploaded_by: string;
  uploaded_at: string;
  document_type_id?: number;
}

export interface ParcelStatusHistory {
  id: number;
  parcel_id: string;
  acquisition_id: string;
  status_id: number;
  status_name: string;
  status_date: string;
  created_by: string;
}

export interface ParcelWorkflow {
  id: number;
  from_status_id: number | null;
  to_status_id: number;
  from_status_name: string;
  to_status_name: string;
  sort_order: number;
}

export interface AcquisitionWorkflow {
  id: number;
  from_status_id: number | null;
  to_status_id: number;
  from_status_name: string;
  to_status_name: string;
  sort_order: number;
}

export interface AcquisitionStatusItem {
  id: number;
  name: string;
}

export interface ParcelFull extends Parcel {
  acquisition_id: string;
  old_parcel_id?: string;
  valid_from?: string;
  valid_till?: string;
  geometry_wkt: string;
  acquisition_geom_wkt: string;
  status_id: number;
  status_name: string;
  created_at: string;
  created_by: string;
  detail?: ParcelDetail;
  // computed parcel meta
  remaining_area_m2?: number;
  db_changed: boolean;
  changed_parcel_id: string;
  // Independent org assigned to this parcel for independent valuation (Хөндлөнгийн үнэлгээ)
  independent_org_id?: string;
  independent_org_name?: string;
}

// Чөлөөлөлтийн (acquisition) статусын ID-ууд.
// Role тогтмолуудыг lib/access-policy.ts (ACCESS_ROLE_CODES / ACCESS_ROLE_NAMES)-д
// төвлөрүүлсэн тул энд давхардуулахгүй — тэндээс import хийж ашиглана.
export const ACQ_STATUS = {
  CONFIRMED: 3, // Баталгаажсан — цаашид засвар/устгал хийх боломжгүй (locked)
} as const;

export interface ParcelDetail {
  right_type: number;
  holder_last_name: string;
  holder_name: string;
  holder_register_no: string;
  holder_phone: string;
  holder_email: string;
  holder_type: string;
  holder_civil_id: string;
  app_no: string;
  decision_no: string;
  decision_date?: string;
  contract_no: string;
  contract_date?: string;
  certificate_no: string;
  certificate_date?: string;
  valuation_zone: string;
  base_price_per_ha?: number;
  auction_coeff?: number;
  auction_price?: number;
}

export interface GlobalParcel {
  id: string;
  parcel_id: string;
  au1_code: string;
  au2_code: string;
  au3_code: string;
  right_type: number;
  landuse: string;
  area_m2: number;
  acquisition_area_m2: number;
  compensation_paid: boolean;
  status: number;
  status_id: number;
  status_name: string;
  acquisition_id: string;
  acquisition_name: string;
  plan_code: string;
  acquisition_status: number;
  start_date?: string;
  end_date?: string;
  cash_amount: number;
  land_grant_amount: number;
  land_grant_count: number;
}

export interface ReportParcelRow {
  parcel_id: string;
  area_m2: number;
  acquisition_area_m2: number;
  remaining_area_m2: number;
  right_type: number;
  db_changed: boolean;
  changed_parcel_id: string;
  acquisition_id: string;
  acquisition_name: string;
  plan_code: string;
  general_category_name: string;
  sub_category_name: string;
  decree_number: string;
  decree_date?: string;
  holder_last_name: string;
  holder_name: string;
  holder_register_no: string;
  land_comp: number;
  real_state_comp: number;
  property_comp: number;
  total_comp: number;
}

export interface Asset {
  id: string;
  acquisition_id: string;
  parcel_id: string;
  asset_number: string;
  asset_type: "real_state" | "property";
  asset_name: string;
  floor_count: number;
  area_m2: number;
  owner_name: string;
  address: string;
  notes: string;
  unit: string;
  capacity: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface AssetSpec {
  id: string;
  asset_id: string;
  spec_type_id: number;
  spec_code: string;
  spec_name: string;
  value: string;
}

export interface AssetCalculation {
  id: string;
  asset_id: string;
  calc_type_id: number;
  calc_code: string;
  calc_name: string;
  unit: string;
  value: number;
}

export interface AssetSpecType {
  id: number;
  code: string;
  name: string;
  sort_order: number;
}

export interface AssetCalcType {
  id: number;
  code: string;
  name: string;
  default_unit: string;
  sort_order: number;
}

export interface LandValuation {
  id: string;
  acquisition_id: string;
  parcel_id: string;
  land_area_m2: number;
  base_price_per_m2: number;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export interface CompensationGrant {
  id: string;
  acquisition_id: string;
  compensation_id: string;
  amount: number;
  grant_date?: string;
  note?: string;
  land_area_m2: number;
  land_price: number;
  land_location: string;
  land_purpose: string;
  land_use_type: string;
  parcel_number: string;
  decree_number: string;
  created_at: string;
  updated_at: string;
}

export interface Compensation {
  id: string;
  acquisition_id: string;
  target_type: "parcel" | "asset";
  parcel_id: string;
  asset_id?: string;
  compensation_type: "cash" | "land_grant";
  coverage_percent: number;
  amount: number;
  compensation_date?: string;
  note?: string;
  grant?: CompensationGrant;
  status: "pending" | "approved" | "rejected";
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  valuation_report_url?: string;
  valuation_report_name?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface GlobalCompensation extends Compensation {
  acquisition_name: string;
  holder_name: string;
  holder_last_name: string;
  holder_register_no: string;
  holder_phone: string;
}

export interface CompensationHistory {
  id: string;
  compensation_id: string;
  compensation_type: "cash" | "land_grant";
  coverage_percent: number;
  amount: number;
  compensation_date?: string;
  note?: string;
  status: string;
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  archived_at: string;
}

export interface AuthorizedRepresentative {
  id: string;
  acquisition_id: string;
  parcel_id: string;
  last_name: string;
  first_name: string;
  register_no: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  created_at: string;
  created_by: string;
}

export interface ParcelPayment {
  id: string;
  parcel_id: string;
  amount: number;
  currency: string;
  paid_at?: string;
  note: string;
  created_at: string;
  created_by: string;
}

export interface LandAcquisitionFilter {
  plan_code?: string;
  acquisition_name?: string;
  status?: number;
  au3_code?: string;
  general_category_id?: number;
  sub_category_id?: number;
  assigned_user_id?: string;
  years?: number[];
  page?: number;
  page_size?: number;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

export const STATUS_LABELS: Record<number, string> = {
  1: "Шинэ",
  2: "Хээрийн судалгаа",
  3: "Баталгаажсан",
  4: "Цуцлагдсан",
};

export const STATUS_COLORS: Record<number, string> = {
  1: "bg-blue-100 text-blue-800",
  2: "bg-amber-100 text-amber-800",
  3: "bg-green-100 text-green-800",
  4: "bg-red-100 text-red-800",
};
