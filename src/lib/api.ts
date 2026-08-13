import axios from 'axios'
import { toast } from 'sonner'
import { authStorage } from './auth'
import { notifyRequestStart, notifyRequestEnd } from './blocking-loader-state'
import { logger } from './logger'

// Нэг дор олон 401/403 toast гарахаас сэргийлнэ
let _authAlertPending = false
function showAccessDenied(title: string, description: string, withLoginBtn = false) {
  if (_authAlertPending) return
  _authAlertPending = true
  const opts = withLoginBtn
    ? {
        description,
        duration: Infinity as number,
        action: {
          label: 'Нэвтрэх',
          onClick: () => { window.location.href = '/login' },
        },
        onDismiss: () => { _authAlertPending = false },
      }
    : {
        description,
        duration: 7000,
        onDismiss: () => { _authAlertPending = false },
        onAutoClose: () => { _authAlertPending = false },
      }
  toast.error(title, opts)
}
import type {
  ApiResponse, PaginatedResponse, LoginResponse,
  User, Role, Permission,
  Organization, Department, Position, Person, Employee,
  AuditLog,
  Plan, LandAcquisition, LandAcquisitionFilter, Parcel, ParcelFull, ParcelDiscoveryResult,
  AcquisitionProgress, Document, StatusOption,
  GlobalParcel, ParcelPayment, Asset, Compensation, CompensationGrant, GlobalCompensation,
  ConstructionType, AcquisitionCategory, ReportParcelRow, ReportSummary, ParcelStatus, AcquisitionProgressStatus, DocumentType,
  AcquisitionAssignee, ParcelWorkflow, ParcelStatusHistory, BoundaryHistory, FundingSource,
  CompensationHistory, AuthorizedRepresentative, LandValuation, LandValuationUpsert, ValuationImportPayload, ValuationImportResult, AssetSpec, AssetCalculation,
  DroneImage,
  DroneUploadTicket,
  ValuationSubmission, ValuationSubmissionHistory,
  AssetSpecType, AssetCalcType,
  DecisionDraft, DecisionDraftParcel, DecisionDraftFundingLink, DecisionDraftProgressHistory, DecisionOption, FundingSourceOption,
} from '@/types'

// Backend алдаа / timeout / сүлжээ тасрах үед хэрэглэгчийг хуудаснаас ХӨӨХГҮЙ.
//
// Өмнө нь дурын 5xx эсвэл timeout бүтэн апп-ыг /server-error руу шиддэг байсан:
// жижиг алдаа (нэг график, нэг жагсаалт унасан) ч хэрэглэгчийн бөглөж байсан
// форм, сонголтыг үгүй хийж байв. Одоо зөвхөн НЭГ анхааруулга харуулна —
// бусад хэсэг ажиллаж, хэрэглэгч ажлаа үргэлжлүүлнэ.
//
// /server-error хуудас нь зөвхөн frontend хуудас байхгүй/эвдэрсэн үед
// (app/not-found.tsx, app/error.tsx) хэрэглэгдэнэ.
let _serverAlertPending = false
function showServerError(description: string) {
  if (typeof window === 'undefined' || _serverAlertPending) return
  _serverAlertPending = true
  toast.error('Серверт холбогдоход алдаа гарлаа', {
    description,
    duration: 7000,
    action: {
      label: 'Дахин ачаалах',
      onClick: () => window.location.reload(),
    },
    onDismiss: () => { _serverAlertPending = false },
    onAutoClose: () => { _serverAlertPending = false },
  })
}

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
  status_id?: number
  unlinked_only?: boolean
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
  general_category_id?: number
  sub_category_id?: number
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

function parcelListSearchParams(params?: ParcelListParams): URLSearchParams {
  const q = new URLSearchParams()
  if (!params) return q

  if (params.page) q.set('page', String(params.page))
  if (params.page_size) q.set('page_size', String(params.page_size))
  if (params.parcel_id) q.set('parcel_id', params.parcel_id)
  if (params.right_type) q.set('right_type', String(params.right_type))
  if (params.landuse) q.set('landuse', params.landuse)
  if (params.au3_code) q.set('au3_code', params.au3_code)
  if (params.acquisition_id) q.set('acquisition_id', params.acquisition_id)
  if (params.acquisition_name) q.set('acquisition_name', params.acquisition_name)
  if (params.plan_code) q.set('plan_code', params.plan_code)
  if (params.status != null) q.set('status', String(params.status))
  if (params.status_id != null) q.set('status_id', String(params.status_id))
  if (params.unlinked_only) q.set('unlinked_only', 'true')
  params.years?.forEach(year => q.append('year', String(year)))

  return q
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
      if (params?.acquisition_id && acq.id !== params.acquisition_id) return false
      const name = params?.acquisition_name?.trim().toLowerCase()
      if (name && !(acq.acquisition_name ?? '').toLowerCase().includes(name)) return false
      const plan = params?.plan_code?.trim().toLowerCase()
      if (plan && !(acq.plan_code ?? '').toLowerCase().includes(plan)) return false
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
      status_id: parcel.status ?? 0,
      status_name: parcel.status_name ?? "",
      cash_amount: parcel.cash_amount ?? 0,
      land_grant_amount: parcel.land_grant_amount ?? 0,
      land_grant_count: parcel.land_grant_count ?? 0,
    }))
  }))

  const filtered = parcelPages.flat().filter(parcel => {
    if (params?.right_type && parcel.right_type !== params.right_type) return false
    if (params?.au3_code && parcel.au3_code !== params.au3_code) return false
    if (params?.status_id && parcel.status_id !== params.status_id) return false
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

// _silent: true — арын хүсэлтүүд (мэдэгдлийн poll г.м.) бүтэн дэлгэцийн
// блоклогч loader-ийг асаахгүй байх тохиргоо.
declare module 'axios' {
  export interface AxiosRequestConfig {
    _silent?: boolean
  }
}

api.interceptors.request.use((config) => {
  const token = authStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Эрхийн шалгалтыг backend (/prof group + middleware) дээр төвлөрүүлсэн.
  // Frontend талд урьдчилсан allowlist хийхгүй — false 403 (Хандах эрхгүй)
  // toast гарахаас сэргийлж, backend-тэй зөрчилдөхөөс зайлсхийнэ.
  if (!config._silent) notifyRequestStart()
  return config
})

api.interceptors.response.use(
  (res) => {
    if (!res.config._silent) notifyRequestEnd()
    // Амжилттай хүсэлт БҮРийг логлохгүй — өдөрт олон мянган (ихэнхдээ 200 OK)
    // бичлэг Loki руу урсаж, /api/client-log-ыг real API-тай ойролцоо тоогоор
    // дуудуулж байсан бол илт хэрэггүй чимээ. Зөвхөн алдааг доор логлоно.
    return res
  },
  async (error) => {
    if (!error.config?._silent) notifyRequestEnd()

    const status = error.response?.status
    const isAuthRoute = error.config?.url?.startsWith('/auth/')

    if (!error.config?._silent) {
      logger.error('api request failed', {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status,
        code: error.code,
        // Сервэрийн буцаасан аль хэдийн хэрэглэгчид зориулсан аюулгүй мессеж
        // (i18n-жуулсан) — хүсэлтийн бие/header-ийг хэзээ ч логлохгүй.
        error: error.response?.data?.error ?? error.response?.data?.message,
      })
    }

    // ── Хүсэлт цуцлагдсан (компонент unmount, шинэ хайлт) — алдаа биш, чимээгүй өнгөрөөнө ──
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject(error)
    }

    // ── Backend алдаа (5xx) / timeout / холбогдож чадсангүй ──────────────────
    // Хуудсыг ХАЯХГҮЙ: анхааруулга харуулж, алдааг дуудсан код өөрөө
    // (useQuery-ийн error state, mutation-ийн onError) шийднэ.
    const noResponse = !error.response // network error эсвэл timeout (ECONNABORTED)
    const isServerError = typeof status === 'number' && status >= 500
    if (!isAuthRoute && (noResponse || isServerError)) {
      // Арын (_silent) хүсэлтийн түр алдаанд анхааруулга харуулахгүй —
      // дараагийн poll дээр өөрөө сэргэнэ.
      if (!error.config?._silent) {
        showServerError(
          noResponse
            ? 'Сервер хариу өгсөнгүй эсвэл хүсэлт хугацаа хэтэрлээ. Түр хүлээгээд дахин оролдоно уу.'
            : error.response?.data?.error ??
              error.response?.data?.message ??
              'Сервер дээр алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
        )
      }
      return Promise.reject(error)
    }

    // ── 403: хандах эрхгүй (backend эсвэл frontend access-policy) ──────────
    if (status === 403 && !isAuthRoute) {
      if (!error.config?._silent) {
        showAccessDenied('Хандах эрхгүй', 'Энэ үйлдлийг гүйцэтгэх эрх байхгүй байна.')
      }
      return Promise.reject(error)
    }

    // ── 401: нэвтрэх шаардлагатай ──────────────────────────────────────────
    if (status === 401 && !isAuthRoute) {
      // "Гарах" дарж storage цэвэрлэгдсэн (эсвэл нэвтрээгүй) үед үлдэгдэл
      // хүсэлтүүд 401 буцаадаг — энэ нь сесс дууссан хэрэг биш тул анхааруулга
      // харуулахгүйгээр чимээгүй login хуудас руу шилжинэ.
      if (!authStorage.getRefreshToken()) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
      if (!error.config?._retry) {
        // Нэг удаа token refresh хийж үзнэ
        error.config._retry = true
        try {
          const refresh = authStorage.getRefreshToken()
          const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh })
          authStorage.setTokens(data.data.access_token, data.data.refresh_token)
          error.config.headers.Authorization = `Bearer ${data.data.access_token}`
          return api(error.config)
        } catch {
          // Refresh амжилтгүй → session дууссан гэж үзнэ
          authStorage.clear()
          showAccessDenied('Хандах эрхийн хугацаа дууссан', 'Дахин нэвтэрч орно уу.', true)
          return Promise.reject(error)
        }
      }
      // Retry хийсний дараа ч 401 → хандах эрхгүй
      showAccessDenied('Хандах эрхгүй', 'Энэ үйлдлийг гүйцэтгэх эрх байхгүй байна.')
    }

    return Promise.reject(error)
  },
)

// ── Auth ────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', { username: email, password }).then(r => r.data.data),
  // Refresh токеноо хамт илгээж хоёуланг нь хүчингүй болгоно
  logout: () => api.post('/auth/logout', { refresh_token: authStorage.getRefreshToken() }).then(r => r.data),
  me: () => api.get<ApiResponse<User>>('/users/me').then(r => r.data.data),
}

// ── Users ────────────────────────────────────────────
export const usersApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; role?: string; is_active?: boolean }) =>
    api.get<PaginatedResponse<User>>('/users', { params }).then(r => r.data),
  getById: (id: string) => api.get<ApiResponse<User>>(`/users/${id}`).then(r => r.data.data),
  // role_ids — backend хэрэглэгчийг үүсгэхтэй зэрэг ролиудыг оноож,
  // олгох эрхгүй роль дурдвал хэрэглэгчийг ҮҮСГЭХГҮЙ (хагас биелэхээс сэргийлнэ).
  create: (body: { username: string; email: string; password: string; first_name?: string; last_name?: string; position?: string; employee_id?: string; employee?: EmployeePayload; is_active?: boolean; role_ids?: string[] }) =>
    api.post<ApiResponse<User>>('/users', body).then(r => r.data.data),
  update: (id: string, body: Partial<{ username: string; email: string; first_name: string; last_name: string; position: string; is_active: boolean }>) =>
    api.put<ApiResponse<User>>(`/users/${id}`, body).then(r => r.data.data),
  changePassword: (id: string, password: string) =>
    api.put(`/users/${id}/password`, { password }),
  // Роль олгох/хураах нь тусдаа маршрут — backend дээр эрх нэмэгдүүлэлт болон
  // өөрийн ролийг өөрөө өөрчлөхөөс хамгаалсан шалгалттай.
  assignRole: (userId: string, roleId: string) =>
    api.post(`/users/${userId}/roles`, { role_id: roleId }),
  removeRole: (userId: string, roleId: string) =>
    api.delete(`/users/${userId}/roles/${roleId}`),
  delete: (id: string) => api.delete(`/users/${id}`),
}

export type HRListParams = {
  page?: number
  page_size?: number
  search?: string
  organization_id?: string
  department_id?: string
  is_active?: boolean
}

export type PersonPayload = Partial<Omit<Person, 'id' | 'created_at' | 'updated_at'>> & {
  person_type: 'citizen' | 'legal'
  register_no: string
}

export type EmployeePayload = Partial<Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'person'>> & {
  person_id?: string
  person?: PersonPayload
  organization_id: string
  position_id: string
}

export type OrganizationPayload = Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>> & { name: string }
export type DepartmentPayload = Partial<Omit<Department, 'id' | 'created_at' | 'updated_at'>> & { organization_id: string; name: string }
export type PositionPayload = Partial<Omit<Position, 'id' | 'created_at' | 'updated_at'>> & { name: string }

export const organizationApi = {
  list: (params?: HRListParams) => api.get<PaginatedResponse<Organization>>('/organizations', { params }).then(r => r.data),
  create: (body: OrganizationPayload) => api.post<ApiResponse<Organization>>('/organizations', body).then(r => r.data.data),
  update: (id: string, body: Partial<OrganizationPayload>) => api.put<ApiResponse<Organization>>(`/organizations/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/organizations/${id}`),
}

export const departmentApi = {
  list: (params?: HRListParams) => api.get<PaginatedResponse<Department>>('/departments', { params }).then(r => r.data),
  create: (body: DepartmentPayload) => api.post<ApiResponse<Department>>('/departments', body).then(r => r.data.data),
  update: (id: string, body: Partial<DepartmentPayload>) => api.put<ApiResponse<Department>>(`/departments/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/departments/${id}`),
}

export const positionApi = {
  list: (params?: HRListParams) => api.get<PaginatedResponse<Position>>('/positions', { params }).then(r => r.data),
  create: (body: PositionPayload) => api.post<ApiResponse<Position>>('/positions', body).then(r => r.data.data),
  update: (id: string, body: Partial<PositionPayload>) => api.put<ApiResponse<Position>>(`/positions/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/positions/${id}`),
}

export const personApi = {
  list: (params?: HRListParams) => api.get<PaginatedResponse<Person>>('/persons', { params }).then(r => r.data),
  create: (body: PersonPayload) => api.post<ApiResponse<Person>>('/persons', body).then(r => r.data.data),
  update: (id: string, body: Partial<PersonPayload>) => api.put<ApiResponse<Person>>(`/persons/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/persons/${id}`),
}

export const employeeApi = {
  list: (params?: HRListParams) => api.get<PaginatedResponse<Employee>>('/employees', { params }).then(r => r.data),
  getById: (id: string) => api.get<ApiResponse<Employee>>(`/employees/${id}`).then(r => r.data.data),
  create: (body: EmployeePayload) => api.post<ApiResponse<Employee>>('/employees', body).then(r => r.data.data),
  update: (id: string, body: Partial<EmployeePayload>) => api.put<ApiResponse<Employee>>(`/employees/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/employees/${id}`),
}

// ── Roles ─────────────────────────────────────────────
// Backend returns Go PascalCase fields; normalize to frontend camelCase
function normalizePermission(p: any): Permission {
  return {
    id: p.ID ?? p.id,
    name: p.Name ?? p.name,
    description: p.Description ?? p.description,
  }
}

function normalizeRole(r: any): Role {
  const rawPerms: unknown[] = r.Permissions ?? r.permissions ?? []
  return {
    id: r.ID ?? r.id,
    name: r.Name ?? r.name,
    description: r.Description ?? r.description,
    permissions: rawPerms.map(normalizePermission),
  }
}

export const rolesApi = {
  list: () =>
    api.get<PaginatedResponse<Role>>('/roles').then(r => ({
      ...r.data,
      data: (r.data.data ?? []).map(normalizeRole),
    })),
  getById: (id: string) =>
    api.get<ApiResponse<Role>>(`/roles/${id}`).then(r => normalizeRole(r.data.data)),
  create: (body: { name: string; description?: string }) =>
    api.post<ApiResponse<Role>>('/roles', body).then(r => normalizeRole(r.data.data)),
  update: (id: string, body: { name?: string; description?: string }) =>
    api.put<ApiResponse<Role>>(`/roles/${id}`, body).then(r => normalizeRole(r.data.data)),
  delete: (id: string) => api.delete(`/roles/${id}`),
  assignPermission: (roleId: string, permissionId: string) =>
    api.post(`/roles/${roleId}/permissions`, { permission_id: permissionId }),
  removePermission: (roleId: string, permissionId: string) =>
    api.delete(`/roles/${roleId}/permissions/${permissionId}`),
}

// ── Permissions ───────────────────────────────────────
export const permissionsApi = {
  list: () =>
    api.get<PaginatedResponse<Permission>>('/permissions').then(r => ({
      ...r.data,
      data: (r.data.data ?? []).map(normalizePermission),
    })),
  create: (body: { name: string; description?: string }) =>
    api.post<ApiResponse<Permission>>('/permissions', body).then(r => normalizePermission(r.data.data)),
  delete: (id: string) => api.delete(`/permissions/${id}`),
}

export const auditApi = {
  list: (params?: {
    page?: number
    page_size?: number
    actor_id?: string
    action?: string
    resource_type?: string
    resource_id?: string
    acquisition_id?: string
    parcel_id?: string
    created_from?: string
    created_to?: string
  }) =>
    api.get<PaginatedResponse<AuditLog>>('/audit-logs', { params }).then(r => r.data),
}

// ── Land Acquisitions ─────────────────────────────────
export const landApi = {
  listConstructionTypes: () =>
    api.get<ApiResponse<ConstructionType[]>>('/construction-types').then(r => r.data.data),
  listCategories: (parentId?: number) =>
    api.get<ApiResponse<AcquisitionCategory[]>>('/acquisition-categories', {
      params: parentId !== undefined ? { parent_id: parentId } : undefined,
    }).then(r => r.data.data ?? []),
  list: (filter?: LandAcquisitionFilter) => {
    const p = new URLSearchParams()
    if (filter?.plan_code)           p.set('plan_code', filter.plan_code)
    if (filter?.acquisition_name)    p.set('acquisition_name', filter.acquisition_name)
    if (filter?.status)              p.set('status', String(filter.status))
    if (filter?.au3_code)            p.set('au3_code', filter.au3_code)
    if (filter?.general_category_id) p.set('general_category_id', String(filter.general_category_id))
    if (filter?.sub_category_id)     p.set('sub_category_id', String(filter.sub_category_id))
    if (filter?.assigned_user_id)    p.set('assigned_user_id', filter.assigned_user_id)
    if (filter?.page)                p.set('page', String(filter.page))
    if (filter?.page_size)           p.set('page_size', String(filter.page_size))
    filter?.years?.forEach(y => p.append('year', String(y)))
    return api.get<PaginatedResponse<LandAcquisition>>(`/land-acquisitions?${p}`).then(r => r.data)
  },
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
  getParcels: (id: string, params?: { page?: number; page_size?: number; parcel_id?: string; au1_code?: string; au2_code?: string; au3_code?: string; right_type?: number; landuse?: string; status_id?: number }) =>
    api.get<PaginatedResponse<Parcel>>(`/land-acquisitions/${id}/parcels`, { params }).then(r => r.data),
  getAssets: (id: string, params?: { page?: number; page_size?: number; parcel_id?: string; valuation_type?: string }) =>
    api.get<PaginatedResponse<Asset>>(`/land-acquisitions/${id}/assets`, { params }).then(r => r.data),
  createAsset: (acqId: string, body: Partial<Asset>) =>
    api.post<ApiResponse<Asset>>(`/land-acquisitions/${acqId}/assets`, body).then(r => r.data.data),
  updateAsset: (acqId: string, assetId: string, body: Partial<Asset>) =>
    api.put<ApiResponse<Asset>>(`/land-acquisitions/${acqId}/assets/${assetId}`, body).then(r => r.data.data),
  deleteAsset: (acqId: string, assetId: string) =>
    api.delete(`/land-acquisitions/${acqId}/assets/${assetId}`),
  listAssetSpecs: (acqId: string, assetId: string) =>
    api.get<ApiResponse<AssetSpec[]>>(`/land-acquisitions/${acqId}/assets/${assetId}/specs`).then(r => r.data.data ?? []),
  upsertAssetSpecs: (acqId: string, assetId: string, specs: { spec_type_id: number; value: string }[]) =>
    api.post(`/land-acquisitions/${acqId}/assets/${assetId}/specs`, { specs }),
  listAssetCalculations: (acqId: string, assetId: string) =>
    api.get<ApiResponse<AssetCalculation[]>>(`/land-acquisitions/${acqId}/assets/${assetId}/calculations`).then(r => r.data.data ?? []),
  upsertAssetCalculations: (acqId: string, assetId: string, calculations: { calc_type_id: number; unit: string; value: number }[]) =>
    api.post(`/land-acquisitions/${acqId}/assets/${assetId}/calculations`, { calculations }),
  getLandValuation: (acqId: string, parcelId: string, valuationType?: string) =>
    api.get<ApiResponse<LandValuation | null>>(`/land-acquisitions/${acqId}/land-valuation`, { params: { parcel_id: parcelId, valuation_type: valuationType } }).then(r => r.data.data ?? null),
  upsertLandValuation: (acqId: string, body: LandValuationUpsert) =>
    api.post<ApiResponse<LandValuation>>(`/land-acquisitions/${acqId}/land-valuation`, body).then(r => r.data.data),
  deleteLandValuation: (acqId: string, parcelId: string, valuationType?: string) =>
    api.delete(`/land-acquisitions/${acqId}/land-valuation`, { params: { parcel_id: parcelId, valuation_type: valuationType } }).then(() => undefined),
  importValuation: (acqId: string, body: ValuationImportPayload) =>
    api.post<ApiResponse<ValuationImportResult>>(`/land-acquisitions/${acqId}/valuation-import`, body).then(r => r.data.data),
  listCompensations: (acqId: string, parcelId?: string, valuationType?: string) =>
    api.get<ApiResponse<Compensation[]>>(`/land-acquisitions/${acqId}/compensations`, {
      params: { parcel_id: parcelId || undefined, valuation_type: valuationType || undefined },
    }).then(r => r.data.data ?? []),
  createCompensation: (acqId: string, body: Partial<Compensation>) =>
    api.post<ApiResponse<Compensation>>(`/land-acquisitions/${acqId}/compensations`, body).then(r => r.data.data),
  updateCompensation: (acqId: string, compId: string, body: Partial<Compensation>) =>
    api.put<ApiResponse<Compensation>>(`/land-acquisitions/${acqId}/compensations/${compId}`, body).then(r => r.data.data),
  deleteCompensation: (acqId: string, compId: string) =>
    api.delete(`/land-acquisitions/${acqId}/compensations/${compId}`),
  approveCompensation: (acqId: string, compId: string, note: string) =>
    api.post(`/land-acquisitions/${acqId}/compensations/${compId}/approve`, { note }),
  rejectCompensation: (acqId: string, compId: string, note: string) =>
    api.post(`/land-acquisitions/${acqId}/compensations/${compId}/reject`, { note }),
  uploadCompensationReport: (acqId: string, compId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<ApiResponse<Compensation>>(`/land-acquisitions/${acqId}/compensations/${compId}/report`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data)
  },
  uploadAssetPhoto: (acqId: string, assetId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<ApiResponse<{ photo_pdf_url: string; photo_pdf_name: string }>>(
      `/land-acquisitions/${acqId}/assets/${assetId}/photos`, fd,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then(r => r.data.data)
  },
  listCompensationHistory: (acqId: string, compId: string) =>
    api.get<ApiResponse<CompensationHistory[]>>(`/land-acquisitions/${acqId}/compensations/${compId}/history`).then(r => r.data.data ?? []),
  // Нөхөх олговрын үнэлгээний илгээх/зөвшөөрөх төлөв
  getValuationSubmission: (acqId: string, parcelId: string, valuationType?: string) =>
    api.get<ApiResponse<ValuationSubmission>>(`/land-acquisitions/${acqId}/parcels/${parcelId}/valuation-status`, { params: { valuation_type: valuationType } }).then(r => r.data.data),
  transitionValuationSubmission: (acqId: string, parcelId: string, action: "submit" | "approve" | "return", note: string, valuationType?: string) =>
    api.post<ApiResponse<ValuationSubmission>>(`/land-acquisitions/${acqId}/parcels/${parcelId}/valuation-status`, { action, note, valuation_type: valuationType }).then(r => r.data.data),
  listValuationSubmissionHistory: (acqId: string, parcelId: string, valuationType?: string) =>
    api.get<ApiResponse<ValuationSubmissionHistory[]>>(`/land-acquisitions/${acqId}/parcels/${parcelId}/valuation-status-history`, { params: { valuation_type: valuationType } }).then(r => r.data.data ?? []),
  createCompensationGrant: (acqId: string, compId: string, body: Partial<CompensationGrant>) =>
    api.post<ApiResponse<CompensationGrant>>(`/land-acquisitions/${acqId}/compensations/${compId}/grant`, body).then(r => r.data.data),
  updateCompensationGrant: (acqId: string, compId: string, body: Partial<CompensationGrant>) =>
    api.put<ApiResponse<CompensationGrant>>(`/land-acquisitions/${acqId}/compensations/${compId}/grant`, body).then(r => r.data.data),
  deleteCompensationGrant: (acqId: string, compId: string) =>
    api.delete(`/land-acquisitions/${acqId}/compensations/${compId}/grant`),
  setParcelCompensation: (acqId: string, parcelId: string, paid: boolean) =>
    api.put(`/land-acquisitions/${acqId}/parcels/${parcelId}/compensation`, { paid }).then(r => r.data),
  listAllCompensations: (params?: { status?: string; search?: string; acquisition_id?: string; page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<GlobalCompensation>>('/compensations', { params }).then(r => r.data),
  getGlobalCompensation: (id: string) =>
    api.get<ApiResponse<GlobalCompensation>>(`/compensations/${id}`).then(r => r.data.data),
  getParcel: (acqId: string, parcelId: string) =>
    api.get<ApiResponse<ParcelFull>>(`/land-acquisitions/${acqId}/parcels/${parcelId}`).then(r => r.data.data),
  // Чөлөөлөх хилээр ГУС-аас нэгж талбарын ДУГААРУУДЫГ татаж бүртгэнэ.
  // Дэлгэрэнгүй мэдээлэл татагдахгүй — түүнийг дугаар тус бүрээр syncParcel хийнэ.
  discoverParcels: (acqId: string, opts?: { silent?: boolean }) =>
    api.post<ApiResponse<ParcelDiscoveryResult>>(`/land-acquisitions/${acqId}/parcels/by-acquisition`, undefined, { _silent: opts?.silent }).then(r => r.data.data),
  syncParcel: (acqId: string, parcelId: string, opts?: { silent?: boolean }) =>
    api.post(`/land-acquisitions/${acqId}/parcels/${parcelId}/sync`, undefined, { _silent: opts?.silent }),
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
  getBoundaryHistory: (id: string) =>
    api.get<ApiResponse<BoundaryHistory[]>>(`/land-acquisitions/${id}/boundary-history`).then(r => r.data.data ?? []),
  getAvailableStatuses: (id: string) =>
    api.get<ApiResponse<StatusOption[]>>(`/land-acquisitions/${id}/available-statuses`).then(r => r.data.data ?? []),
  advanceStatus: (id: string, toStatus: number, note?: string, decreeNumber?: string, decreeDate?: string) =>
    api.post<ApiResponse<LandAcquisition>>(`/land-acquisitions/${id}/advance`, {
      to_status: toStatus,
      note: note ?? '',
      decree_number: decreeNumber ?? '',
      decree_date: decreeDate ?? null,
    }).then(r => r.data.data),
  updateParcelMeta: (acqId: string, parcelId: string, dbChanged: boolean, changedParcelId: string, acquisitionAreaM2?: number, acquisitionGeomWkt?: string) =>
    api.patch(`/land-acquisitions/${acqId}/parcels/${parcelId}/meta`, {
      db_changed: dbChanged,
      changed_parcel_id: changedParcelId,
      ...(acquisitionAreaM2 != null ? { acquisition_area_m2: acquisitionAreaM2 } : {}),
      ...(acquisitionGeomWkt ? { acquisition_geom_wkt: acquisitionGeomWkt } : {}),
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

  // ── Дроны ортофото (.tif) ──────────────────────────────────────────────
  // Нэг хүсэлтэд НЭГ файл — олон зургийг дараалан байршуулна.
  //
  // Файл BACKEND-ЭЭР ДАМЖИХГҮЙ. Гурван алхам:
  //   1. createDroneUploadUrl  — backend-ээс байршуулах зөвшөөрөл (presigned URL)
  //   2. putDroneFileDirect    — browser файлыг ШУУД файлын систем руу PUT
  //   3. registerDroneImage    — backend объектыг шалгаж чөлөөлөлтөд холбоно
  // Ингэснээр хэдэн GB ортофото ч API-ийн санах ой, хугацаа, хүсэлтийн
  // хэмжээний хязгаараас хамаарахгүй — хэмжээний хязгаар байхгүй.
  listDroneImages: (acqId: string) =>
    api.get<ApiResponse<DroneImage[]>>(`/land-acquisitions/${acqId}/drone-images`)
      .then(r => r.data.data ?? []),
  createDroneUploadUrl: (acqId: string, fileName: string) =>
    api.post<ApiResponse<DroneUploadTicket>>(
      `/land-acquisitions/${acqId}/drone-images/upload-url`,
      { file_name: fileName },
    ).then(r => r.data.data),
  // Файлыг ӨӨРИЙН origin-ий `/api/files/...` руу тавина. Next-ийн route нь
  // биеийг урсгалаар MinIO руу дамжуулна.
  //
  // ЯАГААД MinIO-руу ШУУД БИШ: presigned URL-ийн host нь backend-ийн хаяг
  // (container-т `minio:9000`) — browser түүнийг шийдэж чаддаггүй. Мөн шууд
  // хандвал MinIO-ийн порт гадаад сүлжээнд нээлттэй байх, CORS ажиллах
  // шаардлагатай болдог. Өөрийн origin-руу тавихад тэр гурав нь бүгд арилна.
  //
  // Зөвшөөрөл нь presigned URL-ийн query (X-Amz-*) дотор — түүнийг хэвээр
  // дамжуулж, MinIO өөрөө шалгана. `api` instance-ыг хэрэглэхгүй: Authorization
  // header нь гарын үсэгтэй зөрчилдөж, interceptor нь файлын серверийн хариуд
  // хөндлөнгөөс оролцох ёсгүй.
  putDroneFileDirect: (
    ticket: DroneUploadTicket,
    file: File,
    onProgress?: (percent: number) => void,
  ) =>
    axios.put(ticket.file_url + '?' + new URL(ticket.url).search.replace(/^\?/, ''), file, {
      headers: { 'Content-Type': 'image/tiff' },
      timeout: 0,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      onUploadProgress: (e) => {
        if (!onProgress || !e.total) return
        onProgress(Math.round((e.loaded / e.total) * 100))
      },
    }).then(() => undefined),
  // timeout: 0 — бүртгэл нь GeoServer-т давхарга нийтлэхийг ДОТРОО хийдэг тул
  // ердийн 30 сек-ийн хязгаарт багтахгүй байж болно. GeoServer растрын толгойг
  // (IFD) HTTP Range-ээр уншина: жинхэнэ COG дээр 1-2 сек, харин COG БИШ
  // GeoTIFF-ийн толгой файлын төгсгөлд байдаг тул файлыг эхнээс дуустал мөлхөж
  // уншиж, хэмжээнээсээ хамаарч минут хүрч болно.
  //
  // 30 сек-ийн хязгаар нь ЯГ ЭНЭ ШАЛТГААНААР 138 MB, COG биш ортофотог
  // оруулахад алдаа гаргаж байсан: browser 30 сек-т таслахад backend-ийн
  // context цуцлагдаж нийтлэлт хагасаас тасарч, хэрэглэгчид "сервер алдаа"
  // харагдаж байв (харин 190 MB-ийн COG нь 1 сек-т нийтлэгдэж хэвийн ордог —
  // ХЭМЖЭЭ биш, ФАЙЛЫН БҮТЭЦ шалтгаан болж байсан).
  registerDroneImage: (acqId: string, storedName: string, originalName: string) =>
    api.post<ApiResponse<DroneImage>>(`/land-acquisitions/${acqId}/drone-images`, {
      stored_name: storedName,
      original_name: originalName,
    }, { timeout: 0 }).then(r => r.data.data),
  // Зураг байршуулсны ДАРАА автоматаар дуудна — GeoServer-ийн мозайкийг
  // шинэчилж (harvest + reset) шинэ зургийг давхаргад харагдахаар болгоно.
  //
  // _silent: true — GeoServer унасан/тохиргоо эвдэрсэн үед 500 буцаж болно.
  // Тэр үед хэрэглэгчийг /server-error хуудас руу ШИДЭХГҮЙ: зураг аль хэдийн
  // файлын системд хадгалагдсан, зөвхөн давхаргад бүртгэгдээгүй байна. Дуудагч
  // алдааг барьж анхааруулга харуулж, "GeoServer шинэчлэх" товчоор дахин
  // оролдох боломж үлдэнэ.
  refreshDroneImages: (acqId: string) =>
    api.post<ApiResponse<DroneImage[]>>(`/land-acquisitions/${acqId}/drone-images/refresh`, undefined, {
      timeout: 0,
      _silent: true,
    }).then(r => r.data.data ?? []),
  deleteDroneImage: (acqId: string, imageId: string) =>
    api.delete(`/land-acquisitions/${acqId}/drone-images/${imageId}`),

  getAssignees: (acquisitionId: string): Promise<AcquisitionAssignee[]> =>
    api.get<ApiResponse<AcquisitionAssignee[]>>(`/land-acquisitions/${acquisitionId}/assignees`)
      .then(r => r.data.data ?? []),

  setAssignees: (acquisitionId: string, users: { user_id: string; user_name: string; user_position?: string }[]): Promise<AcquisitionAssignee[]> =>
    api.put<ApiResponse<AcquisitionAssignee[]>>(`/land-acquisitions/${acquisitionId}/assignees`, { users })
      .then(r => r.data.data ?? []),

  // Set the professional org user for an acquisition
  setProfessionalOrg: (acquisitionId: string, orgUserId: string | null) =>
    api.put(`/land-acquisitions/${acquisitionId}/professional-org`, { org_user_id: orgUserId }),

  // Set the independent org user for a specific parcel
  setParcelIndependentOrg: (acqId: string, parcelId: string, orgUserId: string | null) =>
    api.patch(
      `/land-acquisitions/${acqId}/parcels/${parcelId}/independent-org`,
      { org_user_id: orgUserId }
    ),

  // Funding sources — жагсаалт нь getById-ийн funding_sources талбараар ирдэг (тусдаа GET байхгүй)
  createFundingSource: (acqId: string, body: Omit<FundingSource, 'id' | 'acquisition_id' | 'created_at' | 'created_by'>) =>
    api.post<ApiResponse<FundingSource>>(`/land-acquisitions/${acqId}/funding-sources`, body).then(r => r.data.data),
  updateFundingSource: (acqId: string, srcId: string, body: Partial<Omit<FundingSource, 'id' | 'acquisition_id' | 'created_at' | 'created_by'>>) =>
    api.put<ApiResponse<FundingSource>>(`/land-acquisitions/${acqId}/funding-sources/${srcId}`, body).then(r => r.data.data),
  deleteFundingSource: (acqId: string, srcId: string) =>
    api.delete(`/land-acquisitions/${acqId}/funding-sources/${srcId}`),

  // AuthorizedRepresentative
  listRepresentatives: (acqId: string, parcelId: string) =>
    api.get<ApiResponse<AuthorizedRepresentative[]>>(`/land-acquisitions/${acqId}/parcels/${parcelId}/representatives`).then(r => r.data.data ?? []),
  createRepresentative: (acqId: string, parcelId: string, body: Omit<AuthorizedRepresentative, 'id' | 'acquisition_id' | 'parcel_id' | 'created_at' | 'created_by'>) =>
    api.post<ApiResponse<AuthorizedRepresentative>>(`/land-acquisitions/${acqId}/parcels/${parcelId}/representatives`, body).then(r => r.data.data),
  deleteRepresentative: (acqId: string, parcelId: string, repId: string) =>
    api.delete(`/land-acquisitions/${acqId}/parcels/${parcelId}/representatives/${repId}`),

  // List users with professional_org role (for org selectors)
  listProfessionalOrgUsers: () =>
    api.get<PaginatedResponse<User>>('/users', { params: { role: 'professional_org', page_size: 200 } })
      .then(r => {
        const users = r.data.data ?? []
        return users.filter(user => {
          if (!Array.isArray(user.roles) || user.roles.length === 0) return true
          return user.roles.some(role => role.name === 'professional_org' || role.id === 'professional_org')
        })
      }),
}

// ── Global Parcels ────────────────────────────────────
export const parcelApi = {
  list: async (params?: ParcelListParams) => {
    const q = parcelListSearchParams(params)
    const suffix = q.toString()

    try {
      return await api.get<PaginatedResponse<GlobalParcel>>(`/parcels${suffix ? `?${suffix}` : ''}`).then(r => r.data)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404 && !params?.years?.length) {
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
  getAvailableStatuses: (acqId: string, parcelId: string) =>
    api.get<ApiResponse<ParcelStatus[]>>(`/land-acquisitions/${acqId}/parcels/${parcelId}/available-statuses`)
      .then(r => r.data.data ?? []),
  updateStatus: (acqId: string, parcelId: string, statusId: number) =>
    api.patch(`/land-acquisitions/${acqId}/parcels/${parcelId}/status`, { status_id: statusId }),
  listStatusHistory: (acqId: string, parcelId: string) =>
    api.get<ApiResponse<ParcelStatusHistory[]>>(`/land-acquisitions/${acqId}/parcels/${parcelId}/status-history`)
      .then(r => r.data.data ?? []),
}

// ── Parcel Workflow ───────────────────────────────────
export const parcelWorkflowApi = {
  list: () =>
    api.get<ApiResponse<ParcelWorkflow[]>>('/parcel-workflow').then(r => r.data.data ?? []),
  create: (body: { from_status_id: number | null; to_status_id: number; sort_order?: number }) =>
    api.post<{ code: number; data: ParcelWorkflow }>('/parcel-workflow', body).then(r => r.data.data),
  delete: (id: number) => api.delete(`/parcel-workflow/${id}`),
}

// ── Report rows ───────────────────────────────────────
function reportQueryString(params?: ReportListParams): string {
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
  if (params?.general_category_id) q.set('general_category_id', String(params.general_category_id))
  if (params?.sub_category_id) q.set('sub_category_id', String(params.sub_category_id))
  return q.toString()
}

export const reportApi = {
  list: (params?: ReportListParams) => {
    const suffix = reportQueryString(params)
    return api.get<PaginatedResponse<ReportParcelRow>>(`/report/download${suffix ? `?${suffix}` : ''}`).then(r => r.data)
  },
  // Жагсаалтын дээд хэсгийн статистикийн картуудад зориулсан нэгтгэсэн тоо/дүн —
  // бүх хуудсыг client талд дараалан татахын оронд НЭГ л дуудлагаар авна.
  summary: (params?: Omit<ReportListParams, 'page' | 'page_size'>) => {
    const suffix = reportQueryString(params)
    return api.get<ApiResponse<ReportSummary>>(`/report/summary${suffix ? `?${suffix}` : ''}`).then(r => r.data.data)
  },
}

// ── Plans ─────────────────────────────────────────────
export const planApi = {
  search: (code: string) =>
    api.get<ApiResponse<Plan>>('/plans/search', { params: { code } }).then(r => r.data.data),
  suggest: (q: string) =>
    api.get<ApiResponse<Plan[]>>('/plans/suggest', { params: { q } }).then(r => r.data.data ?? []),
}

// ── Asset Spec Types (admin) ──────────────────────────
export const assetSpecTypeApi = {
  list: () =>
    api.get<ApiResponse<AssetSpecType[]>>('/asset-spec-types').then(r => r.data.data ?? []),
  create: (body: { code: string; name: string; sort_order: number }) =>
    api.post<AssetSpecType>('/asset-spec-types', body).then(r => r.data),
  update: (id: number, body: { code: string; name: string; sort_order: number }) =>
    api.put<ApiResponse<AssetSpecType>>(`/asset-spec-types/${id}`, body).then(r => r.data.data),
  delete: (id: number) =>
    api.delete(`/asset-spec-types/${id}`),
}

// ── Asset Calc Types (admin) ──────────────────────────
export const assetCalcTypeApi = {
  list: () =>
    api.get<ApiResponse<AssetCalcType[]>>('/asset-calc-types').then(r => r.data.data ?? []),
  create: (body: { code: string; name: string; default_unit: string; sort_order: number }) =>
    api.post<AssetCalcType>('/asset-calc-types', body).then(r => r.data),
  update: (id: number, body: { code: string; name: string; default_unit: string; sort_order: number }) =>
    api.put<ApiResponse<AssetCalcType>>(`/asset-calc-types/${id}`, body).then(r => r.data.data),
  delete: (id: number) =>
    api.delete(`/asset-calc-types/${id}`),
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

export interface ValuationStatusStat {
  status: string
  count:  number
}

export interface ValuationTypeStat {
  valuation_type: string
  count:          number
  amount:         number
}

export interface DashboardData {
  acquisitions:         LandAcquisition[]
  parcel_statuses:      ParcelStatus[]
  total_parcels:        number
  freed_parcels:        number
  freed_area_m2:        number
  plan_area_m2:         number
  total_orders:         number
  total_compensation:   number
  status_breakdown:     ParcelStatusStat[]
  timeline:             TimelinePoint[]
  valuation_statuses?:  ValuationStatusStat[]
  valuation_types?:     ValuationTypeStat[]
  filtered_parcel_ids:  string[]
  filtered_au1_codes:   string[]
  filtered_au2_codes:   string[]
  filtered_au3_codes:   string[]
}

export type DashboardFilter = {
  acquisition_id?:      string
  plan_code?:           string
  status?:              number
  years?:               number[]
  general_category_id?: number
  sub_category_id?:     number
  assigned_user_id?:    string
}

export const dashboardApi = {
  get: (filter?: DashboardFilter): Promise<DashboardData> => {
    const params = new URLSearchParams()
    if (filter?.acquisition_id)      params.set('acquisition_id', filter.acquisition_id)
    if (filter?.plan_code)           params.set('plan_code', filter.plan_code)
    if (filter?.status)              params.set('status', String(filter.status))
    if (filter?.general_category_id) params.set('general_category_id', String(filter.general_category_id))
    if (filter?.sub_category_id)     params.set('sub_category_id', String(filter.sub_category_id))
    if (filter?.assigned_user_id)    params.set('assigned_user_id', filter.assigned_user_id)
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

export const acquisitionWorkflowApi = {
  list: () =>
    api.get<ApiResponse<import('@/types').AcquisitionWorkflow[]>>('/acquisition-workflow').then(r => r.data.data ?? []),
  listStatuses: () =>
    api.get<ApiResponse<import('@/types').AcquisitionStatusItem[]>>('/acquisition-workflow/statuses').then(r => r.data.data ?? []),
  create: (body: { from_status_id: number | null; to_status_id: number; sort_order?: number }) =>
    api.post<{ code: number; data: import('@/types').AcquisitionWorkflow }>('/acquisition-workflow', body).then(r => r.data.data),
  delete: (id: number) => api.delete(`/acquisition-workflow/${id}`),
}

export const acquisitionCategoryApi = {
  list: (parentId?: number) =>
    api.get<ApiResponse<AcquisitionCategory[]>>('/acquisition-categories', {
      params: parentId !== undefined ? { parent_id: parentId } : undefined,
    }).then(r => r.data.data ?? []),
  create: (body: { name: string; parent_id?: number | null; sort_order?: number }) =>
    api.post<{ code: number; data: AcquisitionCategory }>('/acquisition-categories', body).then(r => r.data.data),
  update: (id: number, body: { name: string; sort_order?: number }) =>
    api.put<ApiResponse<AcquisitionCategory>>(`/acquisition-categories/${id}`, body).then(r => r.data.data),
  delete: (id: number) => api.delete(`/acquisition-categories/${id}`),
}

// ── Захирамжийн төсөл ─────────────────────────────────
export type DecisionDraftListParams = {
  page?: number
  page_size?: number
  proposal_no?: string
  decree_number?: string
  location?: string
  parcel_id?: string
  date_from?: string
  date_to?: string
  duration_year?: number
  status?: number
  acquisition_id?: string
  funding_source_id?: string
  work_type_id?: number
  budget_id?: number
}

// parcelListSearchParams-ийн адил — хоосон/0 утгыг query-д огт оруулахгүй.
function decisionDraftSearchParams(params?: DecisionDraftListParams): URLSearchParams {
  const q = new URLSearchParams()
  if (!params) return q
  if (params.page) q.set('page', String(params.page))
  if (params.page_size) q.set('page_size', String(params.page_size))
  if (params.proposal_no) q.set('proposal_no', params.proposal_no)
  if (params.decree_number) q.set('decree_number', params.decree_number)
  if (params.location) q.set('location', params.location)
  if (params.parcel_id) q.set('parcel_id', params.parcel_id)
  if (params.date_from) q.set('date_from', params.date_from)
  if (params.date_to) q.set('date_to', params.date_to)
  if (params.duration_year) q.set('duration_year', String(params.duration_year))
  if (params.status) q.set('status', String(params.status))
  if (params.acquisition_id) q.set('acquisition_id', params.acquisition_id)
  if (params.funding_source_id) q.set('funding_source_id', params.funding_source_id)
  if (params.work_type_id) q.set('work_type_id', String(params.work_type_id))
  if (params.budget_id) q.set('budget_id', String(params.budget_id))
  return q
}

// Санхүүгийн эх үүсвэр энд БАЙХГҮЙ — үүсгэсний дараа addFundingSource-оор
// олноор нэмнэ.
export type DecisionDraftBody = {
  proposal_no: string
  location?: string
  duration_year?: number | null
  work_type_id?: number | null
  budget_id?: number | null
}

export const decisionDraftApi = {
  list: (params?: DecisionDraftListParams) => {
    const suffix = decisionDraftSearchParams(params).toString()
    return api
      .get<PaginatedResponse<DecisionDraft>>(`/decision-drafts${suffix ? `?${suffix}` : ''}`)
      .then(r => r.data)
  },
  get: (id: string) =>
    api.get<ApiResponse<DecisionDraft>>(`/decision-drafts/${id}`).then(r => r.data.data),
  create: (body: DecisionDraftBody) =>
    api.post<ApiResponse<DecisionDraft>>('/decision-drafts', body).then(r => r.data.data),
  update: (id: string, body: DecisionDraftBody) =>
    api.put<ApiResponse<DecisionDraft>>(`/decision-drafts/${id}`, body).then(r => r.data.data),
  delete: (id: string) => api.delete(`/decision-drafts/${id}`),
  // Явц нэмэх — захирамжийн дугаар/огноог бөглөж баталгаажуулна
  confirm: (id: string, body: { decree_number: string; decision_date: string; note: string }) =>
    api.post<ApiResponse<DecisionDraft>>(`/decision-drafts/${id}/confirm`, body).then(r => r.data.data),
  addProgress: (id: string, body: { progress_type: string; recipient: string; progress_date: string; note: string }) =>
    api.post<ApiResponse<DecisionDraftProgressHistory>>(`/decision-drafts/${id}/progress`, body).then(r => r.data.data),
  listProgressHistory: (id: string) =>
    api.get<ApiResponse<DecisionDraftProgressHistory[]>>(`/decision-drafts/${id}/progress-history`).then(r => r.data.data ?? []),

  listParcels: (id: string) =>
    api.get<ApiResponse<DecisionDraftParcel[]>>(`/decision-drafts/${id}/parcels`).then(r => r.data.data ?? []),
  // Нэгж талбар холбохдоо түүнийг санхүүжүүлэх эх үүсвэрийг заавал сонгоно
  linkParcel: (id: string, parcelUuid: string, fundingLinkId: string) =>
    api.post<ApiResponse<DecisionDraftParcel[]>>(`/decision-drafts/${id}/parcels`, {
      parcel_uuid: parcelUuid,
      funding_link_id: fundingLinkId,
    }).then(r => r.data.data ?? []),
  // Холбогдсон нэгж талбарын эх үүсвэрийг солих
  setParcelFundingSource: (id: string, linkId: string, fundingLinkId: string) =>
    api.patch<ApiResponse<DecisionDraftParcel[]>>(`/decision-drafts/${id}/parcels/${linkId}/funding-source`, {
      funding_link_id: fundingLinkId,
    }).then(r => r.data.data ?? []),
  unlinkParcel: (id: string, linkId: string) =>
    api.delete<ApiResponse<DecisionDraftParcel[]>>(`/decision-drafts/${id}/parcels/${linkId}`)
      .then(r => r.data.data ?? []),

  // Санхүүгийн эх үүсвэр — олон нэмж болно. Нэмэх/хасах бүгд шинэчлэгдсэн
  // жагсаалтыг буцаана.
  listFundingSources: (id: string) =>
    api.get<ApiResponse<DecisionDraftFundingLink[]>>(`/decision-drafts/${id}/funding-sources`)
      .then(r => r.data.data ?? []),
  addFundingSource: (id: string, fundingSourceId: string, amount: number) =>
    api.post<ApiResponse<DecisionDraftFundingLink[]>>(`/decision-drafts/${id}/funding-sources`, {
      funding_source_id: fundingSourceId,
      amount,
    })
      .then(r => r.data.data ?? []),
  removeFundingSource: (id: string, linkId: string) =>
    api.delete<ApiResponse<DecisionDraftFundingLink[]>>(`/decision-drafts/${id}/funding-sources/${linkId}`)
      .then(r => r.data.data ?? []),

  // Нэгж талбарын "Захирамж" таб
  listByParcel: (parcelUuid: string) =>
    api.get<ApiResponse<DecisionDraftParcel[]>>(`/parcels/${parcelUuid}/decision-drafts`).then(r => r.data.data ?? []),
}

// Санхүүгийн эх үүсвэрийн сонголт — бүх чөлөөлөлтийн funding_sources
export const fundingSourceOptionApi = {
  list: () =>
    api.get<ApiResponse<FundingSourceOption[]>>('/funding-sources').then(r => r.data.data ?? []),
  // Гараар шинэ эх үүсвэр бүртгэнэ — funding_sources хүснэгтэд чөлөөлөлтгүй
  // (бие даасан) мөр болж бичигдэнэ.
  create: (body: {
    organization_name: string
    source_type: string
    amount?: number | null
    currency?: string
    note?: string
  }) => api.post<ApiResponse<FundingSourceOption>>('/funding-sources', body).then(r => r.data.data),
}

// Ажлын төрөл / Төсөв — parcelStatusApi-тай ижил хэв маяг
function decisionOptionApi(path: string) {
  return {
    list: () => api.get<ApiResponse<DecisionOption[]>>(path).then(r => r.data.data ?? []),
    create: (body: { code: string; name: string; sort_order?: number }) =>
      api.post<ApiResponse<DecisionOption>>(path, body).then(r => r.data.data),
    update: (id: number, body: { code?: string; name?: string; sort_order?: number }) =>
      api.put<ApiResponse<DecisionOption>>(`${path}/${id}`, body).then(r => r.data.data),
    delete: (id: number) => api.delete(`${path}/${id}`),
  }
}

export const decisionWorkTypeApi = decisionOptionApi('/decision-work-types')
export const decisionBudgetApi = decisionOptionApi('/decision-budgets')

// ── Мэдэгдэл ────────────────────────────────────────
// Бүх хүсэлт _silent — хонхны арын шинэчлэлт бүтэн дэлгэцийн
// блоклогч loader асаахгүй, түр алдаа нь хэрэглэгчид мэдэгдэхгүй.
export const notificationApi = {
  list: (params?: { unread?: boolean; page?: number; page_size?: number }) =>
    api
      .get<PaginatedResponse<import('@/types').AppNotification>>('/notifications', {
        params: { ...(params?.unread ? { unread: true } : {}), page: params?.page ?? 1, page_size: params?.page_size ?? 15 },
        _silent: true,
      })
      .then(r => ({ items: r.data.data ?? [], total: r.data.total ?? 0 })),
  unreadCount: () =>
    api
      .get<ApiResponse<{ count: number }>>('/notifications/unread-count', { _silent: true })
      .then(r => r.data.data?.count ?? 0),
  markRead: (id: string) => api.post(`/notifications/${id}/read`, undefined, { _silent: true }),
  markAllRead: () => api.post('/notifications/read-all', undefined, { _silent: true }),
}

export default api
