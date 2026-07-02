"use client";
import { authStorage, decodeJwtPayload } from "./auth";
import {
  canAccessAcquisitionForActor,
  canAccessParcelForActor,
  canEditValuationSubTabForActor,
  canViewValuationSubTabForActor,
  hasAccessRole,
  isExternalSpecialActor,
  isFinanceSpecialistActor,
  isMikaActor,
  isProfessionalOrgActor,
  isSeniorSpecialistActor,
  type AccessActor,
  type AccessAcquisition,
  type AccessParcel,
  type ValuationSubTabKey,
} from "./access-policy";

function getTokenPayload(): Record<string, unknown> | null {
  return decodeJwtPayload(authStorage.getAccessToken());
}

export function getCurrentActor(): AccessActor {
  const payload = getTokenPayload();
  return {
    userId: (payload?.user_id as string) ?? null,
    roles: Array.isArray(payload?.roles) ? (payload.roles as string[]) : [],
  };
}

export function hasRole(...names: string[]): boolean {
  return hasAccessRole(getCurrentActor(), ...names);
}

export function hasPermission(name: string): boolean {
  const payload = getTokenPayload();
  if (!payload) return false;
  return (
    Array.isArray(payload.permissions) &&
    (payload.permissions as string[]).includes(name)
  );
}

export function getCurrentUserId(): string | null {
  return getCurrentActor().userId ?? null;
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
