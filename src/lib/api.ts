import axios from 'axios'
import { authStorage } from './auth'
import type {
  ApiResponse, PaginatedResponse, LoginResponse,
  User, Role, Permission,
  Plan, LandAcquisition, LandAcquisitionFilter, Parcel, ParcelFull,
  AcquisitionProgress, Document, StatusOption,
  GlobalParcel, ParcelPayment,
} from '@/types'

const api = axios.create({ baseURL: '/api/v1', timeout: 30000 })

type ParcelListParams = {
  page?: number
  page_size?: number
  parcel_id?: string
  right_type?: number
  landuse?: string
  au3_code?: string
  acquisition_name?: string
  status?: number
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

async function listParcelsFromAcquisitions(params?: ParcelListParams): Promise<PaginatedResponse<GlobalParcel>> {
  const page = params?.page ?? 1
  const pageSize = params?.page_size ?? 20
  const acqPageSize = 100

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
      const name = params?.acquisition_name?.trim().toLowerCase()
      return !name || (acq.acquisition_name ?? '').toLowerCase().includes(name)
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
  list: (filter?: LandAcquisitionFilter) =>
    api.get<PaginatedResponse<LandAcquisition>>('/land-acquisitions', { params: filter }).then(r => r.data),
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
  setParcelCompensation: (acqId: string, parcelId: string, paid: boolean) =>
    api.put(`/land-acquisitions/${acqId}/parcels/${parcelId}/compensation`, { paid }).then(r => r.data),
  getParcel: (acqId: string, parcelId: string) =>
    api.get<ApiResponse<ParcelFull>>(`/land-acquisitions/${acqId}/parcels/${parcelId}`).then(r => r.data.data),
  syncParcel: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync`),
  getProgress: (id: string) =>
    api.get<ApiResponse<AcquisitionProgress[]>>(`/land-acquisitions/${id}/progress`).then(r => r.data.data),
  getAvailableStatuses: (id: string) =>
    api.get<ApiResponse<StatusOption[]>>(`/land-acquisitions/${id}/available-statuses`).then(r => r.data.data),
  advanceStatus: (id: string, toStatus: number, note?: string) =>
    api.post<ApiResponse<LandAcquisition>>(`/land-acquisitions/${id}/advance`, { to_status: toStatus, note: note ?? '' }).then(r => r.data.data),
  listDocuments: (id: string) =>
    api.get<ApiResponse<Document[]>>(`/land-acquisitions/${id}/documents`).then(r => r.data.data ?? []),
  uploadDocument: (id: string, file: File) => {
    const fd = new FormData(); fd.append('file', file)
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
  uploadDocument: (id: string, file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<ApiResponse<Document>>(`/parcels/${id}/documents`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data)
  },
  deleteDocument: (id: string, docId: string) =>
    api.delete(`/parcels/${id}/documents/${docId}`),
}

// ── Plans ─────────────────────────────────────────────
export const planApi = {
  search: (code: string) =>
    api.get<ApiResponse<Plan>>('/plans/search', { params: { code } }).then(r => r.data.data),
}

export default api
