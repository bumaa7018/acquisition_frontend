import axios from 'axios'
import { authStorage } from './auth'
import type {
  ApiResponse, PaginatedResponse, LoginResponse,
  User, Role, Permission,
  LandAcquisition, LandAcquisitionFilter, Parcel, ParcelFull,
} from '@/types'

const api = axios.create({ baseURL: '/api/v1', timeout: 30000 })

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
        error.config.headers.Authorization = `Bearer ${data.access_token}`
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
    api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password }).then(r => r.data.data),
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
  delete: (id: string) => api.delete(`/land-acquisitions/${id}`),
  getParcels: (id: string, params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<Parcel>>(`/land-acquisitions/${id}/parcels`, { params }).then(r => r.data),
  getParcel: (acqId: string, parcelId: string) =>
    api.get<ApiResponse<ParcelFull>>(`/land-acquisitions/${acqId}/parcels/${parcelId}`).then(r => r.data.data),
  syncParcel: (acqId: string, parcelId: string) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync`),
}

export default api
