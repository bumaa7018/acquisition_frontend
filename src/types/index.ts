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
  employee_id?: string;
  employee?: Employee;
  is_active?: boolean;
  roles: Role[];
}

export interface Role {
  id: string;
  code?: string;
  name: string;
  resource?: string;
  description?: string;
  permissions: Permission[];
  menus?: Menu[];
}

export interface Permission {
  id: string;
  code?: string;
  name: string;
  action?: string;
  description?: string;
  resource?: string;
}

export interface Menu {
  id: string;
  code: string;
  name: string;
  parent_id?: string;
  parent_code?: string;
  menu_url?: string;
  menu_icon?: string;
  sort_order?: number;
  permissions?: Permission[];
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_name: string;
  actor_position: string;
  actor_roles: string[];
  action: string;
  resource_type: string;
  resource_id: string;
  acquisition_id?: string;
  parcel_id?: string;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface Plan {
  id?: string;
  plan_code: string;
  name: string;
  area_m2?: number;
  status?: number;
  /** @deprecated Backend буцаахаа больсон — хил зөвхөн backend-д хадгалагдана */
  boundary_wkt?: string;
  // Дундын сервисийн (middleware /plan/project) нэмэлт талбарууд
  code?: string;
  project_id?: string;
  plan_type_name?: string;
  /** Төлөвлөгөөний нэгж талбарын дугаар — төлөвлөгөөг ҮҮГЭЭР хайна */
  parcel_id?: string;
  /** Бүтээн байгуулалтын ажил, ж: "Дамбадаржаа дэд төвийн бүтээн байгуулалтын ажил" */
  gazner?: string;
  start_date?: string | null;
  end_date?: string | null;
  approved_date?: string | null;
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
  target: "acquisition" | "parcel" | "both";
  description?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// HR лавлахууд нь ГУС-ийн sdplatform схем дээр шууд буудаг. Тэр схемд байхгүй
// талбарыг (short_name, register_no, sort_order, external_id ...) энд бүү нэм —
// backend буцаахгүй тул дэлгэц дээр үргэлж хоосон харагдана. Байгууллагын
// нэмэлт мэдээлэл ЗӨВХӨН үнэлгээний байгууллагад хамаарах ба ValuationOrg
// дээр байдаг (аппын өөрийн valuation_org_profile хүснэгт).
export interface Organization {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  organization_id: string;
  organization_name?: string;
  parent_id?: string;
  code?: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface Position {
  id: string;
  code?: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Үнэлгээний (мэргэжлийн) байгууллага — байгууллагын мэдээлэл + ажилтнууд.
 *
 * `id` нь `land_acquisition.professional_org_id` / `parcel.independent_org_id`
 * -д хадгалагдах утга (хэрэглэгчийн ID БИШ).
 */
export interface ValuationOrg {
  id: string;
  name: string;
  short_name: string;
  register_no: string;
  license_no: string;
  license_issued_at?: string;
  license_expires_at?: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  is_active: boolean;
  employee_count: number;
  /** Зөвхөн дэлгэрэнгүй (GET /valuation-orgs/:id) хариултад ирнэ. */
  employees?: Employee[];
  created_at?: string;
  updated_at?: string;
}

/** Байгууллагатай ХАМТ бүртгэгдэх ажилтны маягтын утга. */
export interface ValuationOrgEmployeeInput {
  /** Утгатай бол одоо байгаа ажилтныг засна. */
  id?: string;
  last_name: string;
  first_name: string;
  register_no: string;
  phone: string;
  email: string;
  position_name: string;
  /** Хоосон бол нэвтрэх эрх үүсгэхгүй / хуучныг нь хэвээр үлдээнэ. */
  username?: string;
  /** Зөвхөн шинэ эрх үүсгэх эсвэл нууц үг солиход. */
  password?: string;
}

export interface ValuationOrgPayload {
  name: string;
  short_name?: string;
  register_no?: string;
  license_no?: string;
  license_issued_at?: string | null;
  license_expires_at?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  is_active?: boolean;
  /** Байхгүй бол ажилтнуудад хүрэхгүй; хоосон массив = бүгдийг идэвхгүй болгох. */
  employees?: ValuationOrgEmployeeInput[];
}

export interface Person {
  id: string;
  person_type: "citizen" | "legal";
  register_no: string;
  last_name?: string;
  first_name?: string;
  legal_name?: string;
  civil_id?: string;
  birth_date?: string;
  gender?: "M" | "F";
  phone?: string;
  email?: string;
  address?: string;
  external_id?: string;
  source?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: string;
  person_id: string;
  /**
   * Ажилтны нэвтрэх эрх (hr_employee.user_id). Нэвтрэх эрхгүй ажилтанд байхгүй.
   *
   * Чөлөөлөлтөд ажилтан хуваарилах / ажилтнаар шүүх нь
   * `land_acquisition_assignee.user_id`-тай ажилладаг тул тэдгээр газарт
   * ажилтны биш ЭНЭ ID-г дамжуулна.
   */
  user_id?: string;
  person?: Person;
  person_name?: string;
  organization_id: string;
  organization_name?: string;
  department_id?: string;
  department_name?: string;
  position_id: string;
  position_name?: string;
  work_email?: string;
  work_phone?: string;
  hired_at?: string;
  released_at?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
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
  // Дэлгэрэнгүй (getById) дээр л ирнэ — тусдаа funding-sources GET API байхгүй
  funding_sources?: FundingSource[];
}

/**
 * PUT /land-acquisitions/:id-ийн хариулт.
 *
 * Хил (shapefile) солигдсон үед backend нь ГУС-аас нэгж талбарыг дахин
 * тодорхойлж, шинэ хилд ороогүй болсныг БҮРМӨСӨН устгадаг тул хэдэн талбар
 * нэмэгдэж/хасагдсаныг хариултад буцаана. Хил хөндөгдөөгүй үед эдгээр талбар
 * ирэхгүй (warning ч мөн адил).
 */
export interface LandAcquisitionUpdateResult extends LandAcquisition {
  warning?: string;
  added_parcels?: number;
  removed_parcels?: number;
}

// Шүүлтүүрийн dropdown-ы хөнгөн бүтэц (GET /land-acquisitions/filter-options).
// Үндсэн LandAcquisition-ы 25+ талбарын оронд зөвхөн 4 талбар — dropdown-д
// хэрэгтэй нь тэр л. Дэлгэрэнгүйг landApi.filterOptions тайлбарт.
export interface LandAcquisitionOption {
  id: string;
  acquisition_name: string;
  plan_code: string;
  plan_name: string;
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
  cash_amount?: number;
  land_grant_amount?: number;
  land_grant_count?: number;
  remaining_area_m2?: number;
  compensation_paid: boolean;
  db_changed: boolean;
  changed_parcel_id: string;
  geometry_wkt?: string;
  independent_org_id?: string;
  independent_org_name?: string;
  // Урсгал бүрийн нөхөх олговрын илгээх төлөв (valuation_type → status).
  // Санхүүгийн мэргэжилтэнд зөвхөн илгээсэн/баталгаажсан урсгалтай нэгж талбар харагдана.
  valuation_statuses?: Partial<Record<ValuationType, ValuationStatus>>;
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
  /**
   * Эх системийн (ГУС) баримтын дугаар.
   * - утгатай → эх системээс ТАТАГДСАН хавсралт (устгах боломжгүй, дараагийн
   *   татахад буцаж орж ирнэ)
   * - хоосон/байхгүй → хэрэглэгч ГАРААР оруулсан
   */
  source_doc_id?: string;
  /**
   * ГУС-ийн баримтын үүргийн код (ж: "1"=Өргөдөл, "11"=Кадастрын зураг).
   * Хавсралтыг Кадастр/Төлбөр/Мониторинг гэж бүлэглэхэд ашиглана.
   * document_type_id-тай ХАМААРАЛГҮЙ — дугаарлалт нь огт өөр.
   */
  source_doc_code?: string;
}

/**
 * Нэгж талбарын хавсралт татсаны үр дүн.
 * Татах нь ЗӨВХӨН НЭМЭХ үйлдэл — юу ч устгагдахгүй, дарагдахгүй тул дахин
 * дахин дарж болно (2 дахь удаад saved=0, skipped=N).
 */
/** Эзэмшигчийн мэдээлэл татсаны үр дүн */
export interface ParcelHolderSyncResult {
  /** ГУС-аас ирсэн нийт */
  found: number;
  /** Хадгалагдсан (регистрийн давхардал хассаны дараах) */
  saved: number;
  /** Регистр давхцсан тул алгасагдсан */
  skipped: number;
}

/** Газрын суурь үнэ (ГУС data_cama) */
export interface ParcelBasePrice {
  base_price: number;
  base_price_m2: number;
  calculate_year: number;
}

/** Газрын төлбөрийн нэхэмжлэл */
export interface ParcelInvoice {
  invoice_no: string;
  description: string;
  amount: number;
  paid_amount: number;
  status_id: number;
  status_name: string;
}

export interface ParcelInvoiceSyncResult {
  found: number;
  invoices: ParcelInvoice[];
}

/** Барьцаа. source_parent_id утгатай бол ДАВХАР барьцаа */
export interface ParcelMortgage {
  id: string;
  source_id: string;
  source_parent_id: string;
  app_no: string;
  start_mortgage_period: string;
  end_mortgage_period: string;
  loan_contract_no: string;
  mortgage_contract_no: string;
  loan_contract_amount: number;
  monetary_unit_value: number;
  unit_type: string;
  mortgage_type: string;
  status_id: string;
  status_name: string;
}

/** Шүүхийн шийдвэр */
export interface ParcelCourtDecision {
  id: string;
  source_id: string;
  app_no: string;
  start_period: string;
  end_period: string;
  court_status: string;
  status_name: string;
  court_decision_no: string;
}

/** Хянан баталгааны мэдээлэл */
export interface ParcelMonitoring {
  id: string;
  monitoring_id: string;
  page_no: string;
  status_name: string;
  company_name: string;
  created_at: string;
}

/** Татаж хадгалсан бичлэгийн тоо */
export interface ParcelSyncCountResult {
  found: number;
  saved: number;
}

export interface ParcelDocumentSyncResult {
  /** Эх системд олдсон нийт */
  found: number;
  /** Шинээр нэмэгдсэн */
  saved: number;
  /** Өмнө нь татагдсан тул алгасагдсан */
  skipped: number;
  /** Татсаны дараах ЭЦСИЙН бүх хавсралт — жагсаалтыг үүгээр шууд шинэчилнэ */
  documents: Document[];
}

/**
 * Дроны зургийг файлын систем руу ШУУД байршуулах зөвшөөрөл.
 *
 * Backend-ээс гардаг presigned URL — browser файлыг API-аар дамжуулахгүйгээр
 * тавьдаг тул файлын хэмжээ хязгаарлагдахгүй.
 */
export interface DroneUploadTicket {
  /** Browser ЭНЭ URL руу PUT хийнэ (зөвшөөрөл нь URL дотор) */
  url: string;
  method: string;
  /** Байршуулалт бүтсэний дараа DB-д бичигдэх зам */
  file_url: string;
  /** Хадгалалтад үүсэх файлын нэр — бүртгүүлэхэд буцааж явуулна */
  stored_name: string;
  expires_in_seconds: number;
}

/**
 * Дроны ортофото (.tif). Зураг тус бүр GeoServer дээр ӨӨРИЙН давхаргатай
 * (`layer_name`, ж: "land:drone_orto_ab12cd34"). GeoServer растрыг файлын
 * системээс HTTP Range хүсэлтээр шууд уншдаг тул backend дээр хуулбар байхгүй.
 */
export interface DroneImage {
  id: string;
  acquisition_id: string;
  /** Файлын системд хадгалагдсан нэр (давхаргын нэр эндээс тооцогдоно) */
  file_name: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  /** GeoServer-ээс уншсан WGS84 хүрээ — "зураг дээр очих"-д. Байхгүй байж болно. */
  min_x?: number;
  min_y?: number;
  max_x?: number;
  max_y?: number;
  /** Мозайкийн индекст granule болж бүртгэгдсэн эсэх */
  published: boolean;
  uploaded_at: string;
  uploaded_by?: string;
  /** WMS-д явуулах давхаргын нэр — зураг тус бүрт ӨӨР */
  layer_name: string;
  /**
   * GeoServer-т давхарга үүсгэхэд гарсан алдаа (бүртгэх үед л ирнэ).
   * Зураг хадгалалтад бүтэн орсон тул алдаа биш — гэхдээ шалтгааныг
   * хэрэглэгчид харуулж, "Шинэчлэх"-ээр дахин оролдох боломж үлдээнэ.
   */
  publish_error?: string;
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

// Нөхөх олговрын үнэлгээний илгээх/зөвшөөрөх төлөв (нэгж талбар бүрт).
// "rejected" — өөр урсгал баталгаажихад автоматаар татгалзагдсан (эцсийн).
export type ValuationStatus = "draft" | "submitted" | "approved" | "returned" | "rejected";

export interface ValuationSubmission {
  id: string;
  acquisition_id: string;
  parcel_id: string;
  valuation_type: ValuationType;
  status: ValuationStatus;
  submitted_by: string;
  submitted_at: string | null;
  reviewed_by: string;
  reviewed_at: string | null;
  last_note: string;
  created_at: string;
  updated_at: string;
}

export interface ValuationSubmissionHistory {
  id: number;
  acquisition_id: string;
  parcel_id: string;
  action: "submit" | "approve" | "return" | "reject";
  from_status: string;
  to_status: string;
  note: string;
  created_by: string;
  created_at: string;
}

export const VALUATION_STATUS_LABELS: Record<ValuationStatus, string> = {
  draft: "Хүлээгдэж буй",
  submitted: "Илгээсэн",
  approved: "Баталгаажсан",
  returned: "Буцаагдсан",
  rejected: "Татгалзсан",
};

// Үнэлгээний урсгалын төрөл — дэд табын түлхүүрүүдтэй ижил (asset/independent/mika)
export type ValuationType = "asset" | "independent" | "mika";

export const VALUATION_TYPE_LABELS: Record<ValuationType, string> = {
  asset: "Үндсэн үнэлгээ",
  independent: "Хөндлөнгийн үнэлгээ",
  mika: "МИКА үнэлгээ",
};

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

/**
 * Чөлөөлөх хилээр ГУС-аас нэгж талбарын ДУГААР татаж бүртгэсний үр дүн
 * (POST /land-acquisitions/:id/parcels/by-acquisition).
 *
 * skipped — өөр чөлөөлөлтөд аль хэдийн бүртгэгдсэн тул алгасагдсан дугаарууд
 * (нэгж талбарын дугаар систем даяар давхардахгүй).
 */
export interface ParcelDiscoveryResult {
  total: number;
  created: number;
  existing: number;
  skipped: number;
  parcel_ids: string[];
}

export interface ParcelFull extends Parcel {
  acquisition_id: string;
  old_parcel_id?: string;
  valid_from?: string;
  valid_till?: string;
  // ГУС-аас татагддаг ч урьд нь дэлгэцэд гардаггүй байсан талбарууд
  landuse_name?: string;
  address_khashaa?: string;
  address_streetname?: string;
  property_no?: string;
  /** Бүх эзэмшигч (үндсэн + хамтран). detail.holder_* нь зөвхөн үндсэнийг заана. */
  holders?: ParcelHolder[];
  /** ГУС-аас татагдсан барьцаа. source_parent_id утгатай нь ДАВХАР барьцаа */
  mortgages?: ParcelMortgage[];
  /** Шүүхийн шийдвэрүүд */
  court_decisions?: ParcelCourtDecision[];
  /** Газрын төлбөрийн нэхэмжлэлүүд */
  invoices?: ParcelInvoice[];
  /** Хянан баталгааны мэдээлэл */
  monitorings?: ParcelMonitoring[];
  geometry_wkt: string;
  acquisition_geom_wkt: string;
  status_id: number;
  status_name: string;
  selected_valuation_type?: ValuationType | null;
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
  FIELD_SURVEY: 2, // Хээрийн судалгаа — санхүүгийн мэргэжилтэнд зөвхөн энэ төлөвтэй чөлөөлөлт харагдана
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
  // Өргөдлийн дэлгэрэнгүй — ГУС-аас татагддаг ч урьд нь дэлгэцэд гардаггүй байсан
  app_timestamp?: string;
  app_type?: string;
  app_status?: string;
  decision_no: string;
  decision_date?: string;
  contract_no: string;
  contract_date?: string;
  contract_begin?: string;
  contract_end?: string;
  contract_property_no?: string;
  contract_status?: string;
  certificate_no: string;
  certificate_date?: string;
  // Улсын бүртгэлийн мэдээлэл
  record_no?: string;
  record_date?: string;
  record_certificate_no?: string;
  record_status?: string;
  valuation_zone: string;
  base_price_per_ha?: number;
  auction_coeff?: number;
  auction_price?: number;
}

/**
 * Нэгж талбарын эзэмшигч — нэг хүсэлт (app_no) дээр олон хүн байж болно.
 * main_applicant нь үндсэн өргөдөл гаргагчийг заана; эх системд нэгээс олон
 * үндсэн өргөдөл гаргагч ирэх тохиолдол БАЙНА.
 */
export interface ParcelHolder {
  id: string;
  main_applicant: boolean;
  last_name: string;
  name: string;
  register_no: string;
  phone: string;
  email: string;
  /** Жишээ нь "3: Монгол улсын хуулийн этгээд" — хуулийн этгээд үед last_name хоосон */
  person_type: string;
  app_no: string;
  /** holder = ГУС-аас татагдсан, representative = гараар бүртгэсэн итгэмжлэгдсэн төлөөлөгч */
  holder_role: ParcelHolderRole;
  /** Нөхөн төлбөр хүлээн авах эзэмшигч — нэгж талбарт зөвхөн НЭГ мөр true */
  payment_recipient: boolean;
  note?: string;
  address?: string;
}

export type ParcelHolderRole = "holder" | "representative";

/** Итгэмжлэгдсэн төлөөлөгч бүртгэх маягтын утга (backend first_name = right_holder.name) */
export interface RepresentativeInput {
  last_name: string;
  first_name: string;
  register_no: string;
  phone: string;
  email: string;
  address: string;
  note: string;
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
  status: number;
  status_name: string;
  status_date?: string;
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

export interface ReportStatusStat {
  status: number;
  status_name: string;
  count: number;
}

export interface ReportYearStat {
  year: number;
  count: number;
}

// ReportSummary — тайлангийн жагсаалтын дээд хэсгийн статистикийн карт (бүх
// хуудаслагдсан үр дүнгээр, backend дээр нэг л дуудлагаар тооцоологдоно).
export interface ReportSummary {
  acquisition_count: number;
  parcel_count: number;
  total_area_m2: number;
  total_parcel_area_m2: number;
  total_compensation: number;
  land_compensation: number;
  real_state_compensation: number;
  property_compensation: number;
  other_compensation: number;
  status_breakdown: ReportStatusStat[];
  year_breakdown: ReportYearStat[];
}

export interface Asset {
  id: string;
  acquisition_id: string;
  parcel_id: string;
  asset_number: string;
  asset_type: "real_state" | "property";
  valuation_type: ValuationType;
  asset_name: string;
  floor_count: number;
  area_m2: number;
  owner_name: string;
  address: string;
  notes: string;
  unit: string;
  capacity: string;
  description: string;
  unit_price: number;
  photo_pdf_url?: string;
  photo_pdf_name?: string;
  created_at: string;
  updated_at: string;
}

// Газрын үнэлгээ upsert хийх body — Excel импортын нэмэлт талбарууд заавал биш.
export interface LandValuationUpsert {
  parcel_id: string;
  valuation_type?: ValuationType;
  land_area_m2: number;
  base_price_per_m2: number;
  ownership_cert_no?: string;
  appraiser_org_name?: string;
  appraiser_reg_no?: string;
  appraiser_state_reg_no?: string;
  appraiser_director?: string;
  appraiser_license?: string;
  appraiser_address?: string;
  appraiser_contact?: string;
  source_file_name?: string;
  source_file_hash?: string;
}

// Excel-ээс бүхэл үнэлгээг нэг хүсэлтээр (нэг транзакц) оруулах payload.
export interface ValuationImportAssetPayload {
  asset_number?: string;
  asset_type: "real_state" | "property";
  asset_name: string;
  area_m2: number;
  unit?: string;
  capacity?: string;
  description?: string;
  owner_name?: string;
  notes?: string;
  unit_price?: number;
  compensation_amount?: number; // >0 бол cash нөхөн олговор үүснэ
  specs?: { spec_type_id: number; value: string }[];
  // calc_type_id байвал шууд, байхгүй бол name-ээр backend төрлийг олж/үүсгэнэ. group — бүлгийн нэр.
  calculations?: { calc_type_id?: number; name?: string; group?: string; unit: string; value: number }[];
}

export interface ValuationImportPayload {
  parcel_id: string;
  valuation_type?: ValuationType;
  replace: boolean; // true бол хуучин хөрөнгө/олговрыг эхлээд устгана
  land: {
    land_area_m2: number;
    base_price_per_m2: number;
    ownership_cert_no?: string;
    appraiser_org_name?: string;
    appraiser_reg_no?: string;
    appraiser_state_reg_no?: string;
    appraiser_director?: string;
    appraiser_license?: string;
    appraiser_address?: string;
    appraiser_contact?: string;
    source_file_name?: string;
    source_file_hash?: string;
  };
  assets: ValuationImportAssetPayload[];
}

export interface ValuationImportResult {
  deleted_assets: number;
  deleted_comps: number;
  created_assets: number;
  created_comps: number;
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
  calc_group?: string;
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
  valuation_type?: ValuationType;
  land_area_m2: number;
  base_price_per_m2: number;
  total_value: number;
  ownership_cert_no?: string;
  appraiser_org_name?: string;
  appraiser_reg_no?: string;
  appraiser_state_reg_no?: string;
  appraiser_director?: string;
  appraiser_license?: string;
  appraiser_address?: string;
  appraiser_contact?: string;
  source_file_name?: string;
  source_file_hash?: string;
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
  valuation_type?: ValuationType;
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

// ── Мэдэгдэл ─────────────────────────────────────────
export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id?: string;
  actor_name: string;
  type: string;
  title: string;
  body: string;
  resource_type: "acquisition" | "parcel" | "compensation" | "";
  resource_id: string;
  acquisition_id?: string;
  parcel_id?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

// ── Захирамжийн төсөл ────────────────────────────────
export const DECISION_DRAFT_STATUS_DRAFT = 1;
export const DECISION_DRAFT_STATUS_CONFIRMED = 2;

export const DECISION_DRAFT_STATUS_LABELS: Record<number, string> = {
  [DECISION_DRAFT_STATUS_DRAFT]: "Төсөл",
  [DECISION_DRAFT_STATUS_CONFIRMED]: "Баталгаажсан",
};

// Жагсаалт/дэлгэрэнгүй дээрх төлөвийн badge — parcel-ийн STATUS_CFG-тэй адил
// өнгөний схем (улбар шар = хүлээгдэж буй, ногоон = дууссан).
export const DECISION_DRAFT_STATUS_STYLES: Record<number, { color: string; bg: string }> = {
  [DECISION_DRAFT_STATUS_DRAFT]: { color: "#f59e0b", bg: "#f59e0b18" },
  [DECISION_DRAFT_STATUS_CONFIRMED]: { color: "#0acf97", bg: "#0acf9718" },
};

// Ажлын төрөл / Төсөв — Тохиргооноос удирдагдах сонголт (ижил бүтэцтэй)
export interface DecisionOption {
  id: number;
  code: string;
  name: string;
  sort_order: number;
}

export interface DecisionDraft {
  id: string;
  proposal_no: string;
  decree_number: string;
  decision_date?: string;
  location: string;
  duration_year?: number;
  status: number;
  acquisition_id?: string;
  work_type_id?: number;
  budget_id?: number;
  current_progress_history_id?: string;
  confirmed_at?: string;
  confirmed_by: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  // JOIN-оос ирэх нэрс
  acquisition_name: string;
  plan_code: string;
  work_type_name: string;
  budget_name: string;
  parcel_count: number;
  parcel_area_m2: number;
  // Санхүүгийн эх үүсвэр — үүсгэсний ДАРАА олноор нэмнэ. Жагсаалтад тоо/нэрсийн
  // нийлбэр, дэлгэрэнгүйд бүтэн жагсаалт ирнэ.
  funding_source_count: number;
  funding_source_names: string;
  funding_local_amount: number;
  funding_international_amount: number;
  funding_source_amounts: Record<string, number>;
  funding_source_compensation_amounts: Record<string, number>;
  funding_source_parcel_counts: Record<string, number>;
  funding_source_parcel_areas: Record<string, number>;
  funding_sources?: DecisionDraftFundingLink[];
  current_progress_type: string;
  current_progress_type_name: string;
  current_progress_recipient: string;
  current_progress_date?: string;
  current_progress_note: string;
}

// Захирамж ↔ санхүүгийн эх үүсвэрийн холбоос
export interface DecisionDraftFundingLink {
  id: string;
  decision_draft_id: string;
  funding_source_id: string;
  created_at: string;
  created_by: string;
  // funding_sources-оос JOIN-оор ирэх мэдээлэл
  acquisition_id: string;
  acquisition_name: string;
  organization_name: string;
  source_type: string;
  amount?: number;
  currency: string;
  note: string;
}

export const DECISION_DRAFT_PROGRESS_REVIEWING = "reviewing";
export const DECISION_DRAFT_PROGRESS_CONFIRMING = "confirming";

export const DECISION_DRAFT_PROGRESS_LABELS: Record<string, string> = {
  [DECISION_DRAFT_PROGRESS_REVIEWING]: "Хянагдаж буй",
  [DECISION_DRAFT_PROGRESS_CONFIRMING]: "Баталгаажуулах",
};

export interface DecisionDraftProgressHistory {
  id: string;
  decision_draft_id: string;
  progress_type: string;
  progress_type_name: string;
  recipient: string;
  progress_date: string;
  note: string;
  created_at: string;
  created_by: string;
}

// Захирамж ↔ нэгж талбарын холбоос. removed_at байвал хасагдсан (түүх).
export interface DecisionDraftParcel {
  id: string;
  decision_draft_id: string;
  parcel_uuid: string;
  linked_at: string;
  linked_by: string;
  removed_at?: string;
  removed_by: string;
  // Тухайн нэгж талбарыг санхүүжүүлэх эх үүсвэр (холбох үед сонгож, дараа нь солино)
  funding_link_id?: string;
  funding_source_id?: string;
  funding_organization?: string;
  funding_source_type?: string;
  // Нэгж талбарын мэдээлэл
  parcel_id: string;
  acquisition_id: string;
  acquisition_name: string;
  area_m2: number;
  acquisition_area_m2: number;
  compensation_amount: number;
  parcel_status: number;
  parcel_status_name: string;
  landuse: string;
  // Нэгж талбарын "Захирамж" таб дээр захирамжийн мэдээллийг хамт буцаана
  proposal_no?: string;
  decree_number?: string;
  decision_date?: string;
  decision_status?: number;
  work_type_name?: string;
  budget_name?: string;
  location?: string;
  duration_year?: number;
  current_progress_type?: string;
  current_progress_type_name?: string;
  current_progress_recipient?: string;
  current_progress_date?: string;
  current_progress_note?: string;
}

// Санхүүгийн эх үүсвэрийн сонголт (бүх чөлөөлөлтөөр)
export interface FundingSourceOption {
  id: string;
  acquisition_id: string;
  acquisition_name: string;
  plan_code: string;
  organization_name: string;
  source_type: string;
  amount?: number;
  currency: string;
}
