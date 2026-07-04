// ── Professional Org API ──────────────────────────────────────────────────────
// Мэргэжлийн байгууллагын хэрэглэгчид ашиглах бүх API дуудлага.
// Backend-д /prof prefix-тэй тусдаа route group байна —
// RequireOnlyRole("professional_org") middleware-аар хамгаалагдсан.

import apiClient from '@/lib/api'
import type {
  ApiResponse,
  PaginatedResponse,
  LandAcquisition,
  Parcel,
  ParcelFull,
  ParcelStatus,
  ParcelStatusHistory,
  Asset,
  AssetSpec,
  AssetCalculation,
  AssetSpecType,
  AssetCalcType,
  Compensation,
  CompensationHistory,
  CompensationGrant,
  LandValuation,
  LandValuationUpsert,
  ValuationImportPayload,
  ValuationImportResult,
  Document,
  AuthorizedRepresentative,
  FundingSource,
  AcquisitionCategory,
} from '@/types'

// ── Filter types ──────────────────────────────────────────────────────────────

export type ProfMyAcquisitionFilter = {
  plan_code?: string
  acquisition_name?: string
  status?: number
  au3_code?: string
  page?: number
  page_size?: number
}

export type ProfParcelListParams = {
  page?: number
  page_size?: number
  parcel_id?: string
  au1_code?: string
  au2_code?: string
  au3_code?: string
  right_type?: number
  landuse?: string
  status_id?: number
}

export type ProfAssetListParams = {
  page?: number
  page_size?: number
  parcel_id?: string
}

// ── ProfApi class ─────────────────────────────────────────────────────────────

class ProfApiService {
  // ── Миний чөлөөлөлтүүд ─────────────────────────────────────────────────────
  // GET /prof/land-acquisitions (ListMyAcquisitions хандлага)

  profListMyAcquisitions(filter?: ProfMyAcquisitionFilter): Promise<PaginatedResponse<LandAcquisition>> {
    const p = new URLSearchParams()
    if (filter?.plan_code)        p.set('plan_code', filter.plan_code)
    if (filter?.acquisition_name) p.set('acquisition_name', filter.acquisition_name)
    if (filter?.status)           p.set('status', String(filter.status))
    if (filter?.au3_code)         p.set('au3_code', filter.au3_code)
    if (filter?.page)             p.set('page', String(filter.page))
    if (filter?.page_size)        p.set('page_size', String(filter.page_size))
    return apiClient
      .get<PaginatedResponse<LandAcquisition>>(`/prof/land-acquisitions?${p.toString()}`)
      .then(r => r.data)
  }

  // ── Чөлөөлөлт ──────────────────────────────────────────────────────────────

  profGetAcquisition(id: string): Promise<LandAcquisition | undefined> {
    return apiClient
      .get<ApiResponse<LandAcquisition>>(`/prof/land-acquisitions/${id}`)
      .then(r => r.data.data)
  }

  profListCategories(parentId?: number): Promise<AcquisitionCategory[]> {
    return apiClient
      .get<ApiResponse<AcquisitionCategory[]>>('/acquisition-categories', {
        params: parentId !== undefined ? { parent_id: parentId } : undefined,
      })
      .then(r => r.data.data ?? [])
  }

  profListAcquisitionDocuments(acqId: string): Promise<Document[]> {
    return apiClient
      .get<ApiResponse<Document[]>>(`/prof/land-acquisitions/${acqId}/documents`)
      .then(r => r.data.data ?? [])
  }

  profUploadAcquisitionDocument(acqId: string, file: File, documentTypeId?: number, name?: string): Promise<Document | undefined> {
    const fd = new FormData()
    fd.append('file', file)
    if (documentTypeId) fd.append('document_type_id', String(documentTypeId))
    if (name?.trim()) fd.append('name', name.trim())
    return apiClient
      .post<ApiResponse<Document>>(`/prof/land-acquisitions/${acqId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data.data)
  }

  profDeleteAcquisitionDocument(acqId: string, docId: string): Promise<void> {
    return apiClient.delete(`/prof/land-acquisitions/${acqId}/documents/${docId}`)
  }

  profListFundingSources(acqId: string): Promise<FundingSource[]> {
    return apiClient
      .get<ApiResponse<FundingSource[]>>(`/prof/land-acquisitions/${acqId}/funding-sources`)
      .then(r => r.data.data ?? [])
  }

  // ── Нэгж талбар ────────────────────────────────────────────────────────────

  profListParcels(acqId: string, params?: ProfParcelListParams): Promise<PaginatedResponse<Parcel>> {
    return apiClient
      .get<PaginatedResponse<Parcel>>(`/prof/land-acquisitions/${acqId}/parcels`, { params })
      .then(r => r.data)
  }

  profGetParcel(acqId: string, parcelId: string): Promise<ParcelFull | undefined> {
    return apiClient
      .get<ApiResponse<ParcelFull>>(`/prof/land-acquisitions/${acqId}/parcels/${parcelId}`)
      .then(r => r.data.data)
  }

  profSetParcelIndependentOrg(acqId: string, parcelId: string, orgUserId: string | null): Promise<unknown> {
    return apiClient.patch(
      `/prof/land-acquisitions/${acqId}/parcels/${parcelId}/independent-org`,
      { org_user_id: orgUserId },
    )
  }

  // ── Нэгж талбарын статус ────────────────────────────────────────────────────

  profGetParcelAvailableStatuses(acqId: string, parcelId: string): Promise<ParcelStatus[]> {
    return apiClient
      .get<ApiResponse<ParcelStatus[]>>(
        `/prof/land-acquisitions/${acqId}/parcels/${parcelId}/available-statuses`,
      )
      .then(r => r.data.data ?? [])
  }

  profUpdateParcelStatus(acqId: string, parcelId: string, statusId: number): Promise<unknown> {
    return apiClient.patch(
      `/prof/land-acquisitions/${acqId}/parcels/${parcelId}/status`,
      { status_id: statusId },
    )
  }

  profListParcelStatusHistory(acqId: string, parcelId: string): Promise<ParcelStatusHistory[]> {
    return apiClient
      .get<ApiResponse<ParcelStatusHistory[]>>(
        `/prof/land-acquisitions/${acqId}/parcels/${parcelId}/status-history`,
      )
      .then(r => r.data.data ?? [])
  }

  // ── Нэгж талбарын баримт бичиг ──────────────────────────────────────────────

  profListParcelDocuments(parcelId: string): Promise<Document[]> {
    return apiClient
      .get<ApiResponse<Document[]>>(`/prof/parcels/${parcelId}/documents`)
      .then(r => r.data.data ?? [])
  }

  profUploadParcelDocument(parcelId: string, file: File, documentTypeId?: number, name?: string): Promise<Document | undefined> {
    const fd = new FormData()
    fd.append('file', file)
    if (documentTypeId) fd.append('document_type_id', String(documentTypeId))
    if (name?.trim()) fd.append('name', name.trim())
    return apiClient
      .post<ApiResponse<Document>>(`/prof/parcels/${parcelId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data.data)
  }

  profDeleteParcelDocument(parcelId: string, docId: string): Promise<void> {
    return apiClient.delete(`/prof/parcels/${parcelId}/documents/${docId}`)
  }

  // ── Эрх эзэмшигч төлөөлөгч ─────────────────────────────────────────────────

  profListRepresentatives(acqId: string, parcelId: string): Promise<AuthorizedRepresentative[]> {
    return apiClient
      .get<ApiResponse<AuthorizedRepresentative[]>>(
        `/prof/land-acquisitions/${acqId}/parcels/${parcelId}/representatives`,
      )
      .then(r => r.data.data ?? [])
  }

  profCreateRepresentative(
    acqId: string,
    parcelId: string,
    body: Omit<AuthorizedRepresentative, 'id' | 'acquisition_id' | 'parcel_id' | 'created_at' | 'created_by'>,
  ): Promise<AuthorizedRepresentative | undefined> {
    return apiClient
      .post<ApiResponse<AuthorizedRepresentative>>(
        `/prof/land-acquisitions/${acqId}/parcels/${parcelId}/representatives`,
        body,
      )
      .then(r => r.data.data)
  }

  profDeleteRepresentative(acqId: string, parcelId: string, repId: string): Promise<void> {
    return apiClient.delete(
      `/prof/land-acquisitions/${acqId}/parcels/${parcelId}/representatives/${repId}`,
    )
  }

  // ── Байгааламж ──────────────────────────────────────────────────────────────

  profListAssets(acqId: string, params?: ProfAssetListParams): Promise<PaginatedResponse<Asset>> {
    return apiClient
      .get<PaginatedResponse<Asset>>(`/prof/land-acquisitions/${acqId}/assets`, { params })
      .then(r => r.data)
  }

  profCreateAsset(acqId: string, body: Partial<Asset>): Promise<Asset | undefined> {
    return apiClient
      .post<ApiResponse<Asset>>(`/prof/land-acquisitions/${acqId}/assets`, body)
      .then(r => r.data.data)
  }

  profDeleteAsset(acqId: string, assetId: string): Promise<void> {
    return apiClient.delete(`/prof/land-acquisitions/${acqId}/assets/${assetId}`)
  }

  profListAssetSpecs(acqId: string, assetId: string): Promise<AssetSpec[]> {
    return apiClient
      .get<ApiResponse<AssetSpec[]>>(
        `/prof/land-acquisitions/${acqId}/assets/${assetId}/specs`,
      )
      .then(r => r.data.data ?? [])
  }

  profUpsertAssetSpecs(
    acqId: string,
    assetId: string,
    specs: { spec_type_id: number; value: string }[],
  ): Promise<unknown> {
    return apiClient.post(
      `/prof/land-acquisitions/${acqId}/assets/${assetId}/specs`,
      { specs },
    )
  }

  profListAssetCalculations(acqId: string, assetId: string): Promise<AssetCalculation[]> {
    return apiClient
      .get<ApiResponse<AssetCalculation[]>>(
        `/prof/land-acquisitions/${acqId}/assets/${assetId}/calculations`,
      )
      .then(r => r.data.data ?? [])
  }

  profUpsertAssetCalculations(
    acqId: string,
    assetId: string,
    calculations: { calc_type_id: number; unit: string; value: number }[],
  ): Promise<unknown> {
    return apiClient.post(
      `/prof/land-acquisitions/${acqId}/assets/${assetId}/calculations`,
      { calculations },
    )
  }

  // ── Байгааламжийн төрлүүд (лавлах) ─────────────────────────────────────────

  profListAssetSpecTypes(): Promise<AssetSpecType[]> {
    return apiClient
      .get<ApiResponse<AssetSpecType[]>>('/asset-spec-types')
      .then(r => r.data.data ?? [])
  }

  profListAssetCalcTypes(): Promise<AssetCalcType[]> {
    return apiClient
      .get<ApiResponse<AssetCalcType[]>>('/asset-calc-types')
      .then(r => r.data.data ?? [])
  }

  // ── Нөхөх олговор ──────────────────────────────────────────────────────────

  profListCompensations(acqId: string, parcelId?: string): Promise<Compensation[]> {
    return apiClient
      .get<ApiResponse<Compensation[]>>(`/prof/land-acquisitions/${acqId}/compensations`, {
        params: parcelId ? { parcel_id: parcelId } : undefined,
      })
      .then(r => r.data.data ?? [])
  }

  profCreateCompensation(acqId: string, body: Partial<Compensation>): Promise<Compensation | undefined> {
    return apiClient
      .post<ApiResponse<Compensation>>(`/prof/land-acquisitions/${acqId}/compensations`, body)
      .then(r => r.data.data)
  }

  profDeleteCompensation(acqId: string, compId: string): Promise<void> {
    return apiClient.delete(`/prof/land-acquisitions/${acqId}/compensations/${compId}`)
  }

  profListCompensationHistory(acqId: string, compId: string): Promise<CompensationHistory[]> {
    return apiClient
      .get<ApiResponse<CompensationHistory[]>>(
        `/prof/land-acquisitions/${acqId}/compensations/${compId}/history`,
      )
      .then(r => r.data.data ?? [])
  }

  profUploadCompensationReport(acqId: string, compId: string, file: File): Promise<Compensation | undefined> {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient
      .post<ApiResponse<Compensation>>(
        `/prof/land-acquisitions/${acqId}/compensations/${compId}/report`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then(r => r.data.data)
  }

  profCreateCompensationGrant(acqId: string, compId: string, body: Partial<CompensationGrant>): Promise<CompensationGrant | undefined> {
    return apiClient
      .post<ApiResponse<CompensationGrant>>(
        `/prof/land-acquisitions/${acqId}/compensations/${compId}/grant`,
        body,
      )
      .then(r => r.data.data)
  }

  profUpdateCompensationGrant(acqId: string, compId: string, body: Partial<CompensationGrant>): Promise<CompensationGrant | undefined> {
    return apiClient
      .put<ApiResponse<CompensationGrant>>(
        `/prof/land-acquisitions/${acqId}/compensations/${compId}/grant`,
        body,
      )
      .then(r => r.data.data)
  }

  profDeleteCompensationGrant(acqId: string, compId: string): Promise<void> {
    return apiClient.delete(`/prof/land-acquisitions/${acqId}/compensations/${compId}/grant`)
  }

  // ── Газрын үнэлгээ ──────────────────────────────────────────────────────────

  profGetLandValuation(acqId: string, parcelId: string): Promise<LandValuation | null> {
    return apiClient
      .get<ApiResponse<LandValuation | null>>(
        `/prof/land-acquisitions/${acqId}/land-valuation`,
        { params: { parcel_id: parcelId } },
      )
      .then(r => r.data.data ?? null)
  }

  profDeleteLandValuation(acqId: string, parcelId: string): Promise<void> {
    return apiClient
      .delete(`/prof/land-acquisitions/${acqId}/land-valuation`, { params: { parcel_id: parcelId } })
      .then(() => undefined)
  }

  profUpsertLandValuation(
    acqId: string,
    body: LandValuationUpsert,
  ): Promise<LandValuation | undefined> {
    return apiClient
      .post<ApiResponse<LandValuation>>(
        `/prof/land-acquisitions/${acqId}/land-valuation`,
        body,
      )
      .then(r => r.data.data)
  }

  profImportValuation(
    acqId: string,
    body: ValuationImportPayload,
  ): Promise<ValuationImportResult | undefined> {
    return apiClient
      .post<ApiResponse<ValuationImportResult>>(
        `/prof/land-acquisitions/${acqId}/valuation-import`,
        body,
      )
      .then(r => r.data.data)
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const profApi = new ProfApiService()
export { ProfApiService }
