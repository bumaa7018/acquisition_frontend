export interface ApiResponse<T> {
  code: number
  data: T
  message: string
  error?: string
}

export interface PaginatedResponse<T> {
  code: number
  data: T[]
  message: string
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  roles: Role[]
}

export interface Role {
  id: string
  name: string
  description?: string
  permissions: Permission[]
}

export interface Permission {
  id: string
  name: string
  description?: string
}

export interface Plan {
  id: string
  plan_code: string
  name: string
  area_m2: number
  status: number
  boundary_wkt: string
}

export interface LandAcquisition {
  id: string
  plan_code: string
  plan_name: string
  geometry_wkt: string
  area_m2: number
  status: number
  start_date?: string
  end_date?: string
  acquisition_name: string
  implementing_org: string
  reason: string
  responsible_org: string
  funding_source: string
  created_at: string
  created_by: string
  parcel_count: number
  aus: AU[]
  parcels: Parcel[]
}

export interface AU {
  au1_code: string
  au1_name: string
  au2_code: string
  au2_name: string
  au3_code: string
  au3_name: string
}

export const RIGHT_TYPE_LABELS: Record<number, string> = {
  1: 'Ашиглах',
  2: 'Эзэмших',
  3: 'Өмчлөх',
}

export interface Parcel {
  id: string
  parcel_id: string
  au1_code: string
  au2_code: string
  au3_code: string
  right_type: number
  landuse: string
  area_m2: number
  acquisition_area_m2: number
  compensation_paid: boolean
  geometry_wkt?: string
}

export interface StatusOption {
  id: number
  label: string
}

export interface AcquisitionProgress {
  id: string
  from_status: number
  to_status: number
  note: string
  changed_by: string
  changed_at: string
}

export interface Document {
  id: string
  name: string
  file_type: string
  file_url: string
  size_bytes: number
  note: string
  uploaded_by: string
  uploaded_at: string
}

export interface ParcelFull extends Parcel {
  acquisition_id: string
  old_parcel_id?: string
  valid_from?: string
  valid_till?: string
  geometry_wkt: string
  acquisition_geom_wkt: string
  created_at: string
  created_by: string
  detail?: ParcelDetail
}

export interface ParcelDetail {
  right_type: number
  holder_last_name: string
  holder_name: string
  holder_register_no: string
  holder_phone: string
  holder_email: string
  holder_type: string
  holder_civil_id: string
  app_no: string
  decision_no: string
  decision_date?: string
  contract_no: string
  contract_date?: string
  certificate_no: string
  certificate_date?: string
}

export interface GlobalParcel {
  id: string
  parcel_id: string
  au1_code: string
  au2_code: string
  au3_code: string
  right_type: number
  landuse: string
  area_m2: number
  acquisition_area_m2: number
  compensation_paid: boolean
  acquisition_id: string
  acquisition_name: string
  plan_code: string
  acquisition_status: number
  start_date?: string
  end_date?: string
}

export interface ParcelPayment {
  id: string
  parcel_id: string
  amount: number
  currency: string
  paid_at?: string
  note: string
  created_at: string
  created_by: string
}


export interface LandAcquisitionFilter {
  plan_code?: string
  status?: number
  au3_code?: string
  page?: number
  page_size?: number
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
}

export const STATUS_LABELS: Record<number, string> = {
  1: 'Шинэ',
  2: 'Хээрийн судалгаа',
  3: 'Баталгаажсан',
  4: 'Цуцлагдсан',
}

export const STATUS_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-amber-100 text-amber-800',
  3: 'bg-green-100 text-green-800',
  4: 'bg-red-100 text-red-800',
}
