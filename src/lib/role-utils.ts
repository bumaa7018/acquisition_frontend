"use client";
import { authStorage, decodeJwtPayload } from "./auth";
import {
  canAccessAcquisitionForActor,
  canAccessParcelForActor,
  canCreateDecisionDraftForActor,
  canCreateUser,
  canCreateHrRecord,
  canDeleteDecisionDraftForActor,
  canDeleteHrRecord,
  canDeactivateUser,
  canDeleteUserRow,
  canUpdateDecisionDraftForActor,
  canViewDecisionDraftsForActor,
  canEditValuationSubTabForActor,
  canViewSystemSettings,
  canGrantPermissionForActor,
  canGrantRoleForActor,
  canManageRolePermissions,
  canManageUserRoles,
  canUpdateUser,
  canUpdateHrRecord,
  canViewAcquisitionTabForActor,
  canViewHrRegistry,
  canViewParcelTabForActor,
  canViewPermissions,
  canViewRolesPage,
  canViewUsersPage,
  canViewValuationSubTabForActor,
  actorHasPermission,
  hasAccessRole,
  isExternalSpecialActor,
  isFinanceSpecialistActor,
  isMikaActor,
  isProfessionalOrgActor,
  isSeniorSpecialistActor,
  type AccessActor,
  type AccessAcquisition,
  type AccessParcel,
  type AcquisitionTabKey,
  type ParcelTabKey,
  type ValuationSubTabKey,
} from "./access-policy";

function getTokenPayload(): Record<string, unknown> | null {
  return decodeJwtPayload(authStorage.getAccessToken());
}

/**
 * JWT-ийн ID нэхэмжлэлүүд (`user_id`, `org_id`) нь sdplatform-д int4 тул JSON-д
 * ТОО болж ирдэг. API-ийн хариултууд (`professional_org_id` гэх мэт) харин
 * ТЭМДЭГТ МӨР. Энд мөр болгож нэгтгэхгүй бол `"12" === 12` нь үргэлж false
 * болж, мэргэжлийн байгууллагын хандалт чимээгүй унана.
 */
function idClaim(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value !== "") return value;
  return null;
}

export function getCurrentActor(): AccessActor {
  const payload = getTokenPayload();
  return {
    userId: idClaim(payload?.user_id),
    orgId: idClaim(payload?.org_id),
    roles: Array.isArray(payload?.roles) ? (payload.roles as string[]) : [],
    permissions: Array.isArray(payload?.permissions)
      ? (payload.permissions as string[])
      : [],
  };
}

export function hasRole(...names: string[]): boolean {
  return hasAccessRole(getCurrentActor(), ...names);
}

export function hasPermission(name: string): boolean {
  return actorHasPermission(getCurrentActor(), name);
}

export function getCurrentUserId(): string | null {
  return getCurrentActor().userId ?? null;
}

/** Нэвтэрсэн хэрэглэгчийн ХАРЬЯА байгууллага (JWT-ийн org_id). */
export function getCurrentOrgId(): string | null {
  return getCurrentActor().orgId ?? null;
}

// Мэргэжлийн байгууллага role
export function isProfessionalOrg(): boolean {
  return isProfessionalOrgActor(getCurrentActor());
}

// МИКА role
export function isMika(): boolean {
  return isMikaActor(getCurrentActor());
}

// Санхүүгийн мэргэжилтэн role
export function isFinanceSpecialist(): boolean {
  return isFinanceSpecialistActor(getCurrentActor());
}

// Ахлах мэргэжилтэн role
export function isSeniorSpecialist(): boolean {
  return isSeniorSpecialistActor(getCurrentActor());
}

// Any of the special external roles that can only access acquisition menu
export function isExternalSpecialRole(): boolean {
  return isExternalSpecialActor(getCurrentActor());
}

// Can view Хөрөнгийн үнэлгээ and Хөндлөнгийн үнэлгээ sub-tabs
export function canViewAssetValuation(): boolean {
  return canViewValuationSubTabForActor(getCurrentActor(), "asset");
}

// Can view МИКА sub-tab
export function canViewMikaValuation(): boolean {
  return canViewValuationSubTabForActor(getCurrentActor(), "mika");
}

// Мэргэжлийн байгуулл... can edit Хөрөнгийн үнэлгээ when:
// - parcel status = "Үнэлгээ хийх"
// - they are the assigned professional org for the acquisition
export function canEditAssetValuation(
  parcelStatusName: string | undefined,
  acquisitionProfOrgId: string | null | undefined
): boolean {
  return canEditValuationSubTabForActor(
    getCurrentActor(),
    "asset",
    { status_name: parcelStatusName },
    { professional_org_id: acquisitionProfOrgId },
  );
}

// The selected independent org can edit Хөндлөнгийн үнэлгээ when:
// - parcel status = "Үнэлгээ хийх"
// - they are the assigned independent org for this specific parcel
export function canEditIndependentValuation(
  parcelStatusName: string | undefined,
  parcelIndependentOrgId: string | null | undefined
): boolean {
  return canEditValuationSubTabForActor(
    getCurrentActor(),
    "independent",
    { status_name: parcelStatusName, independent_org_id: parcelIndependentOrgId },
  );
}

// МИКА can edit МИКА sub-tab when parcel status = "Үнэлгээ хийх"
export function canEditMikaValuation(
  parcelStatusName: string | undefined
): boolean {
  return canEditValuationSubTabForActor(
    getCurrentActor(),
    "mika",
    { status_name: parcelStatusName },
  );
}

// Чөлөөлөлтийн дэлгэрэнгүйн таб хандах эрхээр харагдана
export function canViewAcquisitionTab(tab: AcquisitionTabKey): boolean {
  return canViewAcquisitionTabForActor(getCurrentActor(), tab);
}

// Нэгж талбарын дэлгэрэнгүйн таб хандах эрхээр харагдана
export function canViewParcelTab(tab: ParcelTabKey): boolean {
  return canViewParcelTabForActor(getCurrentActor(), tab);
}

export function canViewValuationSubTab(subTab: ValuationSubTabKey, parcel?: AccessParcel | null, acquisition?: AccessAcquisition | null): boolean {
  return canViewValuationSubTabForActor(getCurrentActor(), subTab, parcel, acquisition);
}

export function canEditValuationSubTab(
  subTab: ValuationSubTabKey,
  parcel?: AccessParcel | null,
  acquisition?: AccessAcquisition | null,
): boolean {
  return canEditValuationSubTabForActor(
    getCurrentActor(),
    subTab,
    parcel,
    acquisition,
  );
}

// Check if a professional_org user can access a specific acquisition
// (they must be the assigned professional_org_id OR independent_org on any parcel)
export function canAccessAcquisition(
  acquisitionProfOrgId: string | null | undefined,
  parcels?: AccessParcel[] | null,
): boolean {
  return canAccessAcquisitionForActor(
    getCurrentActor(),
    { professional_org_id: acquisitionProfOrgId },
    parcels,
  );
}

// ── Захирамжийн төсөл ───────────────────────────────────────────────────────
// Захирамжийн төсөлтэй ажиллах мэргэжилтэн decision:* эрхээр ажиллана.

export function canViewDecisionDrafts(): boolean {
  return canViewDecisionDraftsForActor(getCurrentActor());
}

export function canCreateDecisionDraft(): boolean {
  return canCreateDecisionDraftForActor(getCurrentActor());
}

export function canUpdateDecisionDraft(): boolean {
  return canUpdateDecisionDraftForActor(getCurrentActor());
}

export function canDeleteDecisionDraft(): boolean {
  return canDeleteDecisionDraftForActor(getCurrentActor());
}

// ── Хэрэглэгч / роль / эрхийн удирдлагын цэс ────────────────────────────────

export function canViewUsers(): boolean {
  return canViewUsersPage(getCurrentActor());
}

export function canAddUser(): boolean {
  return canCreateUser(getCurrentActor());
}

export function canViewHr(): boolean {
  return canViewHrRegistry(getCurrentActor());
}

export function canAddHr(): boolean {
  return canCreateHrRecord(getCurrentActor());
}

export function canEditHr(): boolean {
  return canUpdateHrRecord(getCurrentActor());
}

export function canRemoveHr(): boolean {
  return canDeleteHrRecord(getCurrentActor());
}

export function canEditUser(): boolean {
  return canUpdateUser(getCurrentActor());
}

/** Устгах товч — өөрийгөө устгахыг хориглоно. */
export function canRemoveUser(targetUserId: string | null | undefined): boolean {
  return canDeleteUserRow(getCurrentActor(), targetUserId);
}

/** Идэвхгүй болгох — өөрийгөө хаахыг хориглоно. */
export function canToggleUserActive(
  targetUserId: string | null | undefined,
): boolean {
  return canDeactivateUser(getCurrentActor(), targetUserId);
}

/** Роль олгох/хураах — өөрийн ролийг өөрөө өөрчлөхийг хориглоно. */
export function canEditUserRoles(
  targetUserId: string | null | undefined,
): boolean {
  return canManageUserRoles(getCurrentActor(), targetUserId);
}

/** Тухайн ролийг олгох/хураах эрх дуудагчид байгаа эсэх (escalation хамгаалалт). */
export function canGrantRole(
  rolePermissionNames: string[] | null | undefined,
): boolean {
  return canGrantRoleForActor(getCurrentActor(), rolePermissionNames);
}

export function canViewRoles(): boolean {
  return canViewRolesPage(getCurrentActor());
}

// Роль нэмэх/устгах/нэр засах нь UI-д байхгүй — Эрх & Роль хуудас нь зөвхөн
// бүртгэлтэй ролиудын эрхийг тохируулна. (Backend-ийн roles:create/delete
// маршрутууд хэвээр байгаа тул access-policy-д нь дүрэм үлдсэн.)
export function canEditRolePermissions(): boolean {
  return canManageRolePermissions(getCurrentActor());
}

export function canListPermissions(): boolean {
  return canViewPermissions(getCurrentActor());
}

export function canViewSettings(): boolean {
  return canViewSystemSettings(getCurrentActor());
}

/** Тухайн эрхийг роль-д олгох боломжтой эсэх (өөрт байгаа эрхийг л олгоно). */
export function canGrantPermission(permissionName: string): boolean {
  return canGrantPermissionForActor(getCurrentActor(), permissionName);
}

// Check if a professional_org user can access a specific parcel
// (parcel must be in "Үнэлгээ хийх" status)
export function canAccessParcel(
  parcelStatusName: string | undefined,
  acquisitionProfOrgId?: string | null,
  parcelIndependentOrgId?: string | null
): boolean {
  return canAccessParcelForActor(
    getCurrentActor(),
    {
      status_name: parcelStatusName,
      independent_org_id: parcelIndependentOrgId,
    },
    { professional_org_id: acquisitionProfOrgId },
  );
}
