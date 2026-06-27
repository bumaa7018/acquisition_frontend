import axios from 'axios'
import { authStorage } from './auth'
import type {
  ApiResponse, PaginatedResponse, LoginResponse,
  User, Role, Permission,
  Plan, LandAcquisition, LandAcquisitionFilter, Parcel, ParcelFull,
  AcquisitionProgress, Document, StatusOption,
  GlobalParcel, ParcelPayment, Asset, Compensation, CompensationGrant,
  ConstructionType, ReportParcelRow, ParcelStatus, AcquisitionProgressStatus, DocumentType,
} from '@/types'

const api = axios.create({ baseURL: '/api/v1', timeout: 30000, headers: { 'Accept-Language': 'mn' } })

type ParcelListParams = {
  page?: number
  page_size?: number
  parcel_id?: string
  right_type?: number
  landuse?: string
  au3_code?: string
  acquisition_id?: string
  acquisition_name?: string
  plan_code?: string
  status?: number
  years?: number[]
}

type ReportListParams = {
  page?: number
  page_size?: number
  acquisition_id?: string
  acquisition_name?: string
  plan_code?: string
  au3_code?: string
  right_type?: number
  landuse?: string
  years?: number[]
  compensation_type?: string
}

type LegacyParcel = Omit<Parcel, 'right_type' | 'compensation_paid'> & {
  right_type: number | string
  compensation_paid?: boolean
}

const LEGACY_RIGHT_TYPES: Record<string, number> = {
  USE: 1,
  USAGE: 1,
  LEASE: 2,
  POSSESSION: 2,
  OWNERSHIP: 3,
}

function normalizeRightType(value: number | string): number {
  if (typeof value === 'number') return value
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) return numeric
  return LEGACY_RIGHT_TYPES[value.toUpperCase()] ?? 0
}

function yearFromDate(value?: string): string {
  return value?.match(/\b\d{4}\b/)?.[0] ?? ''
}

function yearSet(values?: number[]): Set<string> {
  return new Set((values ?? []).map(String).filter(Boolean))
}

async function listParcelsFromAcquisitions(params?: ParcelListParams): Promise<PaginatedResponse<GlobalParcel>> {
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  const acqPageSize = 100
  const selectedYears = yearSet(params?.years)

  const fetchAcquisitions = async (pageNo: number) =>
    api.get<PaginatedResponse<LandAcquisition>>('/land-acquisitions', {
      params: { page: pageNo, page_size: acqPageSize, status: params?.status || undefined },
    }).then(r => r.data)

  const firstAcqPage = await fetchAcquisitions(1)
  const otherAcqPages = firstAcqPage.total_pages > 1
    ? await Promise.all(
        Array.from({ length: firstAcqPage.total_pages - 1 }, (_, i) => fetchAcquisitions(i + 2)),
      )
    : []

  const acquisitions = [firstAcqPage, ...otherAcqPages]
    .flatMap(r => r.data)
    .filter(acq => {
      if (params?.acquisition_id && acq.id !== params.acquisition_id) return false
      const name = params?.acquisition_name?.trim().toLowerCase()
      if (name && !(acq.acquisition_name ?? '').toLowerCase().includes(name)) return false
      const plan = params?.plan_code?.trim().toLowerCase()
      if (plan && !(acq.plan_code ?? '').toLowerCase().includes(plan)) return false
      if (selectedYears.size > 0 && !selectedYears.has(yearFromDate(acq.start_date))) return false
      return true
    })

  const parcelPages = await Promise.all(acquisitions.map(async (acq) => {
    const res = await api.get<PaginatedResponse<LegacyParcel>>(`/land-acquisitions/${acq.id}/parcels`, {
      params: {
        page: 1,
        page_size: 1000,
        parcel_id: params?.parcel_id || undefined,
        landuse: params?.landuse || undefined,
      },
    }).then(r => r.data)

    return res.data.map((parcel): GlobalParcel => ({
      ...parcel,
      right_type: normalizeRightType(parcel.right_type),
      compensation_paid: parcel.compensation_paid ?? false,
      acquisition_id: acq.id,
      acquisition_name: acq.acquisition_name,
      plan_code: acq.plan_code,
      acquisition_status: acq.status,
      start_date: acq.start_date,
      end_date: acq.end_date,
    }))
  }))

  const filtered = parcelPages.flat().filter(parcel => {
    if (params?.right_type && parcel.right_type !== params.right_type) return false
    if (params?.au3_code && parcel.au3_code !== params.au3_code) return false
    return true
  })

  const total = filtered.length
  const start = (page - 1) * pageSize

  return {
    code: 200,
    data: filtered.slice(start, start + pageSize),
    message: firstAcqPage.message,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

api.interceptors.request.use((config) => {
  const token = authStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    console.error('[API Error]', error.config?.method?.toUpperCase(), error.config?.url, error.response?.status, error.response?.data)
    const isAuthRoute = error.config?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && !error.config._retry && !isAuthRoute) {
      error.config._retry = true
      try {
        const refresh = authStorage.getRefreshToken()
        const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh })
        authStorage.setTokens(data.data.access_token, data.data.refresh_token)
        error.config.headers.Authorization = `Bearer ${data.data.access_token}`
        return api(error.config)
      } catch {
        authStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

// ── Auth ────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', { username: email, password }).then(r => r.data.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  me: () => api.get<ApiResponse<User>>('/users/me').then(r => r.data.data),
}

// ── Users ────────────────────────────────────────────
export const usersApi = {
  list: (params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<User>>('/users', { params }).then(r => r.data),
  getById: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`).then(r => r.data.data),
  create: (body: { email: string; password: string; first_name: string; last_name: string }) =>
    api.post<ApiResponse<User>>('/users', body).then(r => r.data.data),
  update: (id: string, body: Partial<{ email: string; first_name: string; last_name: string }>) =>
    api.put<ApiResponse<User>>(`/users/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

// ── Roles ─────────────────────────────────────────────
export const rolesApi = {
  list: () => api.get<PaginatedResponse<Role>>('/roles').then(r => r.data),
  getById: (id: string) => api.get<ApiResponse<Role>>(`/roles/${id}`).then(r => r.data.data),
  create: (body: { name: string; description?: string }) =>
    api.post<ApiResponse<Role>>('/roles', body).then(r => r.data.data),
  update: (id: string, body: { name?: string; description?: string }) =>
    api.put<ApiResponse<Role>>(`/roles/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/roles/${id}`),
  assignPermission: (roleId: string, permissionId: string) =>
    api.post(`/roles/${roleId}/permissions`, { permission_id: permissionId }),
  removePermission: (roleId: string, permissionId: string) =>
    api.delete(`/roles/${roleId}/permissions/${permissionId}`),
}

// ── Permissions ───────────────────────────────────────
export const permissionsApi = {
  list: () => api.get<PaginatedResponse<Permission>>('/permissions').then(r => r.data),
  create: (body: { name: string; description?: string }) =>
    api.post<ApiResponse<Permission>>('/permissions', body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/permissions/${id}`),
}

// ── Land Acquisitions ─────────────────────────────────
export const landApi = {
  listConstructionTypes: () =>
    api.get<ApiResponse<ConstructionType[]>>('/construction-types').then(r => r.data.data),
  list: (filter?: LandAcquisitionFilter) =>
    api.get<PaginatedResponse<LandAcquisition>>('/land-acquisitions', { params: filter }).then(r => r.data),
  suggest: (q: string) =>
    api.get<ApiResponse<{ id: string; acquisition_name: string; plan_code: string }[]>>(
      '/land-acquisitions/suggest', { params: { q } }
    ).then(r => r.data.data ?? []),
  getById: (id: string) =>
    api.get<ApiResponse<LandAcquisition>>(`/land-acquisitions/${id}`).then(r => r.data.data),
  create: (data: FormData) =>
    api.post<ApiResponse<LandAcquisition>>('/land-acquisitions', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data),
  update: (id: string, data: FormData) =>
    api.put<ApiResponse<LandAcquisition>>(`/land-acquisitions/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data),
  delete: (id: string) => api.delete(`/land-acquisitions/${id}`),
  getParcels: (id: string, params?: { page?: number; page_size?: number; parcel_id?: string; right_type?: number; landuse?: string }) =>
    api.get<PaginatedResponse<Parcel>>(`/land-acquisitions/${id}/parcels`, { params }).then(r => r.data),
  getAssets: (id: string, params?: { page?: number; page_size?: number; parcel_id?: string }) =>
    api.get<PaginatedResponse<Asset>>(`/land-acquisitions/${id}/assets`, { params }).then(r => r.data),
  createAsset: (acqId: string, body: Partial<Asset>) =>
    api.post<ApiResponse<Asset>>(`/land-acquisitions/${acqId}/assets`, body).then(r => r.data.data),
  updateAsset: (acqId: string, assetId: string, body: Partial<Asset>) =>
    api.put<ApiResponse<Asset>>(`/land-acquisitions/${acqId}/assets/${assetId}`, body).then(r => r.data.data),
  deleteAsset: (acqId: string, assetId: string) =>
    api.delete(`/land-acquisitions/${acqId}/assets/${assetId}`),
  listCompensations: (acqId: string, parcelId?: string) =>
    api.get<ApiResponse<Compensation[]>>(`/land-acquisitions/${acqId}/compensations`, {
      params: parcelId ? { parcel_id: parcelId } : undefined,
    }).then(r => r.data.data ?? []),
  createCompensation: (acqId: string, body: Partial<Compensation>) =>
    api.post<ApiResponse<Compensation>>(`/land-acquisitions/${acqId}/compensations`, body).then(r => r.data.data),
  updateCompensation: (acqId: string, compId: string, body: Partial<Compensation>) =>
    api.put<ApiResponse<Compensation>>(`/land-acquisitions/${acqId}/compensations/${compId}`, body).then(r => r.data.data),
  deleteCompensation: (acqId: string, compId: string) =>
    api.delete(`/land-acquisitions/${acqId}/compensations/${compId}`),
  createCompensationGrant: (acqId: string, compId: string, body: Partial<CompensationGrant>) =>
    api.post<ApiResponse<CompensationGrant>>(`/land-acquisitions/${acqId}/compensations/${compId}/grant`, body).then(r => r.data.data),
  updateCompensationGrant: (acqId: string, compId: string, body: Partial<CompensationGrant>) =>
    api.put<ApiResponse<CompensationGrant>>(`/land-acquisitions/${acqId}/compensations/${compId}/grant`, body).then(r => r.data.data),
  deleteCompensationGrant: (acqId: string, compId: string) =>
    api.delete(`/land-acquisitions/${acqId}/compensations/${compId}/grant`),
  setParcelCompensation: (acqId: string, parcelId: string, paid: boolean) =>
    api.put(`/land-acquisitions/${acqId}/parcels/${parcelId}/compensation`, { paid }).then(r => r.data),
  getParcel: (acqId: string, parcelId: string) =>
    api.get<ApiResponse<ParcelFull>>(`/land-acquisitions/${acqId}/parcels/${parcelId}`).then(r => r.data.data),
  syncParcel: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync`),
  syncContractAct: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync/contract-act`).then(r => r.data),
  syncValuation: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync/valuation`).then(r => r.data),
  syncSettlementAct: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync/settlement-act`).then(r => r.data),
  syncLocationValuation: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync/location-valuation`).then(r => r.data),
  syncMonitoring: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync/monitoring`).then(r => r.data),
  updateParcelValuation: (acqId: string, parcelId: string, body: { valuation_zone: string; base_price_per_ha?: number | null; auction_coeff?: number | null; auction_price?: number | null }) =>
    api.patch(`/land-acquisitions/${acqId}/parcels/${parcelId}/valuation`, body),
  getProgress: (id: string) =>
    api.get<ApiResponse<AcquisitionProgress[]>>(`/land-acquisitions/${id}/progress`).then(r => r.data.data),
  getAvailableStatuses: (id: string) =>
    api.get<ApiResponse<StatusOption[]>>(`/land-acquisitions/${id}/available-statuses`).then(r => r.data.data),
  advanceStatus: (id: string, toStatus: number, note?: string, decreeNumber?: string, decreeDate?: string) =>
    api.post<ApiResponse<LandAcquisition>>(`/land-acquisitions/${id}/advance`, {
      to_status: toStatus,
      note: note ?? '',
      decree_number: decreeNumber ?? '',
      decree_date: decreeDate ?? null,
    }).then(r => r.data.data),
  updateParcelMeta: (acqId: string, parcelId: string, dbChanged: boolean, changedParcelId: string, acquisitionAreaM2?: number) =>
    api.patch(`/land-acquisitions/${acqId}/parcels/${parcelId}/meta`, {
      db_changed: dbChanged,
      changed_parcel_id: changedParcelId,
      ...(acquisitionAreaM2 != null ? { acquisition_area_m2: acquisitionAreaM2 } : {}),
    }).then(r => r.data),
  listDocuments: (id: string) =>
    api.get<ApiResponse<Document[]>>(`/land-acquisitions/${id}/documents`).then(r => r.data.data ?? []),
  uploadDocument: (id: string, file: File, documentTypeId?: number, name?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (documentTypeId) fd.append('document_type_id', String(documentTypeId))
    if (name?.trim()) fd.append('name', name.trim())
    return api.post<ApiResponse<Document>>(`/land-acquisitions/${id}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data)
  },
  deleteDocument: (id: string, docId: string) =>
    api.delete(`/land-acquisitions/${id}/documents/${docId}`),
}

// ── Global Parcels ────────────────────────────────────
export const parcelApi = {
  list: async (params?: ParcelListParams) => {
    if (params?.years?.length) {
      return listParcelsFromAcquisitions(params)
    }

    try {
      return await api.get<PaginatedResponse<GlobalParcel>>('/parcels', { params }).then(r => r.data)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return listParcelsFromAcquisitions(params)
      }
      throw error
    }
  },
  listPayments: (id: string) =>
    api.get<ApiResponse<ParcelPayment[]>>(`/parcels/${id}/payments`).then(r => r.data.data ?? []),
  addPayment: (id: string, body: { amount: number; currency: string; paid_at?: string; note?: string }) =>
    api.post(`/parcels/${id}/payments`, body).then(r => r.data),
  listDocuments: (id: string) =>
    api.get<ApiResponse<Document[]>>(`/parcels/${id}/documents`).then(r => r.data.data ?? []),
  uploadDocument: (id: string, file: File, documentTypeId?: number, name?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (documentTypeId) fd.append('document_type_id', String(documentTypeId))
    if (name?.trim()) fd.append('name', name.trim())
    return api.post<ApiResponse<Document>>(`/parcels/${id}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data)
  },
  deleteDocument: (id: string, docId: string) =>
    api.delete(`/parcels/${id}/documents/${docId}`),
}

// ── Report rows ───────────────────────────────────────
export const reportApi = {
  list: (params?: ReportListParams) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))
    if (params?.acquisition_id) q.set('acquisition_id', params.acquisition_id)
    if (params?.acquisition_name) q.set('acquisition_name', params.acquisition_name)
    if (params?.plan_code) q.set('plan_code', params.plan_code)
    if (params?.au3_code) q.set('au3_code', params.au3_code)
    if (params?.right_type) q.set('right_type', String(params.right_type))
    if (params?.landuse) q.set('landuse', params.landuse)
    params?.years?.forEach(year => q.append('year', String(year)))
    if (params?.compensation_type) q.set('compensation_type', params.compensation_type)

    const suffix = q.toString()
    return api.get<PaginatedResponse<ReportParcelRow>>(`/report/download${suffix ? `?${suffix}` : ''}`).then(r => r.data)
  },
}

// ── Plans ─────────────────────────────────────────────
export const planApi = {
  search: (code: string) =>
    api.get<ApiResponse<Plan>>('/plans/search', { params: { code } }).then(r => r.data.data),
  suggest: (q: string) =>
    api.get<ApiResponse<Plan[]>>('/plans/suggest', { params: { q } }).then(r => r.data.data ?? []),
}

// ── Dashboard (aggregated) ────────────────────────────
export interface ParcelStatusStat {
  status_id: number
  name:      string
  count:     number
  area_m2:   number
}

export interface TimelinePoint {
  date:  string
  count: number
}

export interface DashboardData {
  acquisitions:       LandAcquisition[]
  parcel_statuses:    ParcelStatus[]
  total_parcels:      number
  freed_parcels:      number
  freed_area_m2:      number
  plan_area_m2:       number
  total_orders:       number
  total_compensation: number
  status_breakdown:   ParcelStatusStat[]
  timeline:           TimelinePoint[]
}

export type DashboardFilter = {
  acquisition_id?: string
  plan_code?:      string
  years?:          number[]
}

export const dashboardApi = {
  get: (filter?: DashboardFilter): Promise<DashboardData> => {
    const params = new URLSearchParams()
    if (filter?.acquisition_id) params.set('acquisition_id', filter.acquisition_id)
    if (filter?.plan_code)      params.set('plan_code', filter.plan_code)
    filter?.years?.forEach(y => params.append('year', String(y)))
    return api.get<ApiResponse<DashboardData>>(`/dashboard?${params}`).then(r => r.data.data)
  },
}

// ── Acquisition Progress Statuses ─────────────────────
export const acquisitionProgressStatusApi = {
  list: () =>
    api.get<ApiResponse<AcquisitionProgressStatus[]>>('/acquisition-progress-statuses').then(r => r.data.data ?? []),
  create: (body: { name: string; description?: string; sort_order?: number }) =>
    api.post<ApiResponse<AcquisitionProgressStatus>>('/acquisition-progress-statuses', body).then(r => r.data.data),
  update: (id: number, body: { name?: string; description?: string; sort_order?: number }) =>
    api.put<ApiResponse<AcquisitionProgressStatus>>(`/acquisition-progress-statuses/${id}`, body).then(r => r.data.data),
  delete: (id: number) => api.delete(`/acquisition-progress-statuses/${id}`),
}

// ── Document Types ────────────────────────────────────
export const documentTypeApi = {
  list: (target?: 'acquisition' | 'parcel' | '') =>
    api.get<ApiResponse<DocumentType[]>>('/document-types', { params: target ? { target } : undefined }).then(r => r.data.data ?? []),
  create: (body: { type: string; name: string; target?: string; description?: string }) =>
    api.post<ApiResponse<DocumentType>>('/document-types', body).then(r => r.data.data),
  update: (id: number, body: { type?: string; name?: string; target?: string; description?: string }) =>
    api.put<ApiResponse<DocumentType>>(`/document-types/${id}`, body).then(r => r.data.data),
  delete: (id: number) => api.delete(`/document-types/${id}`),
}

// ── Parcel Statuses ───────────────────────────────────
export const parcelStatusApi = {
  list: () =>
    api.get<ApiResponse<ParcelStatus[]>>('/parcel-statuses').then(r => r.data.data ?? []),
  create: (body: { code: string; name: string; sort_order?: number }) =>
    api.post<ApiResponse<ParcelStatus>>('/parcel-statuses', body).then(r => r.data.data),
  update: (id: number, body: { code?: string; name?: string; sort_order?: number }) =>
    api.put<ApiResponse<ParcelStatus>>(`/parcel-statuses/${id}`, body).then(r => r.data.data),
  delete: (id: number) => api.delete(`/parcel-statuses/${id}`),
}

export default api
