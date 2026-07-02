export const EVALUATION_STATUS_NAME = "Үнэлгээ хийх";

export const ACCESS_ROLE_CODES = {
  PROFESSIONAL_ORG: "professional_org",
  MIKA: "mika",
  FINANCE_SPECIALIST: "finance_specialist",
  SENIOR_SPECIALIST: "senior_specialist",
} as const;

export const ACCESS_ROLE_NAMES = {
  PROFESSIONAL_ORG: "Мэргэжлийн байгууллага",
  PROFESSIONAL_ORG_SHORT: "Мэргэжлийн байгуулл...",
  MIKA: "МИКА",
  FINANCE_SPECIALIST: "Санхүүгийн мэргэжилтэн",
  FINANCE: "Санхүү",
  SENIOR_SPECIALIST: "Ахлах мэргэжилтэн",
} as const;

export type AccessRole = string;

export type AccessActor = {
  userId?: string | null;
  roles?: AccessRole[] | null;
};

export type AccessAcquisition = {
  professional_org_id?: string | null;
};

export type AccessParcel = {
  status_name?: string | null;
  independent_org_id?: string | null;
};

export type AcquisitionTabKey =
  | "general"
  | "attachments"
  | "progress"
  | "parcels"
  | "assets"
  | "compensation"
  | "assignees"
  | "map";

export type ParcelTabKey =
  | "general"
  | "progress"
  | "realEstate"
  | "documents"
  | "payment"
  | "map"
  | "print";

export type ValuationSubTabKey = "asset" | "independent" | "mika";

function roles(actor: AccessActor): AccessRole[] {
  return actor.roles ?? [];
}

export function hasAccessRole(
  actor: AccessActor,
  ...acceptedRoles: string[]
): boolean {
  return roles(actor).some((role) => acceptedRoles.includes(role));
}

export function isProfessionalOrgActor(actor: AccessActor): boolean {
  return hasAccessRole(
    actor,
    ACCESS_ROLE_CODES.PROFESSIONAL_ORG,
    ACCESS_ROLE_NAMES.PROFESSIONAL_ORG,
    ACCESS_ROLE_NAMES.PROFESSIONAL_ORG_SHORT,
  );
}

export function isMikaActor(actor: AccessActor): boolean {
  return hasAccessRole(actor, ACCESS_ROLE_CODES.MIKA, ACCESS_ROLE_NAMES.MIKA);
}

export function isFinanceSpecialistActor(actor: AccessActor): boolean {
  return hasAccessRole(
    actor,
    ACCESS_ROLE_CODES.FINANCE_SPECIALIST,
    ACCESS_ROLE_NAMES.FINANCE_SPECIALIST,
    ACCESS_ROLE_NAMES.FINANCE,
  );
}

export function isSeniorSpecialistActor(actor: AccessActor): boolean {
  return hasAccessRole(
    actor,
    ACCESS_ROLE_CODES.SENIOR_SPECIALIST,
    ACCESS_ROLE_NAMES.SENIOR_SPECIALIST,
  );
}

export function isExternalSpecialActor(actor: AccessActor): boolean {
  return (
    isProfessionalOrgActor(actor) ||
    isMikaActor(actor) ||
    isFinanceSpecialistActor(actor)
  );
}

export function canAccessAcquisitionForActor(
  actor: AccessActor,
  acquisition?: AccessAcquisition | null,
  parcels?: AccessParcel[] | null,
): boolean {
  if (!isExternalSpecialActor(actor)) return true;
  if (isMikaActor(actor) || isFinanceSpecialistActor(actor)) return true;
  if (!isProfessionalOrgActor(actor) || !actor.userId) return false;

  return (
    acquisition?.professional_org_id === actor.userId ||
    (parcels ?? []).some((parcel) => parcel.independent_org_id === actor.userId)
  );
}

export function canAccessParcelForActor(
  actor: AccessActor,
  parcel?: AccessParcel | null,
  acquisition?: AccessAcquisition | null,
): boolean {
  if (!isExternalSpecialActor(actor)) return true;
  if (parcel?.status_name !== EVALUATION_STATUS_NAME) return false;

  if (isProfessionalOrgActor(actor)) {
    if (!actor.userId) return false;
    return (
      acquisition?.professional_org_id === actor.userId ||
      parcel.independent_org_id === actor.userId
    );
  }

  return isMikaActor(actor) || isFinanceSpecialistActor(actor);
}

export function canViewAcquisitionTabForActor(
  actor: AccessActor,
  tab: AcquisitionTabKey,
): boolean {
  if (!isExternalSpecialActor(actor)) return true;
  return tab === "general" || tab === "parcels";
}

export function canViewParcelTabForActor(
  actor: AccessActor,
  tab: ParcelTabKey,
): boolean {
  if (!isExternalSpecialActor(actor)) return true;
  return tab === "general" || tab === "realEstate";
}

export function canViewValuationSubTabForActor(
  actor: AccessActor,
  subTab: ValuationSubTabKey,
  parcel?: AccessParcel | null,
  acquisition?: AccessAcquisition | null,
): boolean {
  if (subTab === "mika") {
    return isMikaActor(actor) || isFinanceSpecialistActor(actor);
  }

  if (subTab === "independent") {
    // MIKA / санхүү — харах эрхтэй (хяналт шалгалт)
    if (isMikaActor(actor) || isFinanceSpecialistActor(actor)) return true;
    // Мэргэжлийн байгуулл... — зөвхөн тухайн парцелийн independent_org-оор томилогдсон бол
    if (isProfessionalOrgActor(actor)) {
      return !!actor.userId && !!parcel?.independent_org_id &&
        parcel.independent_org_id === actor.userId;
    }
    return false;
  }

  // "asset" — MIKA / санхүү эсвэл үндсэн мэргэжлийн байгуулга (professional_org_id) л харна
  if (isMikaActor(actor) || isFinanceSpecialistActor(actor)) return true;
  if (isProfessionalOrgActor(actor)) {
    if (!actor.userId) return false;
    // Acquisition мэдээлэл байвал professional_org_id-тэй тулгана
    if (acquisition !== undefined && acquisition !== null) {
      return acquisition.professional_org_id === actor.userId;
    }
    // Мэдээлэл байхгүй бол зөвшөөрнө (graceful fallback)
    return true;
  }
  return false;
}

export function canEditValuationSubTabForActor(
  actor: AccessActor,
  subTab: ValuationSubTabKey,
  parcel?: AccessParcel | null,
  acquisition?: AccessAcquisition | null,
): boolean {
  if (parcel?.status_name !== EVALUATION_STATUS_NAME) return false;

  if (subTab === "asset") {
    return (
      isProfessionalOrgActor(actor) &&
      !!actor.userId &&
      acquisition?.professional_org_id === actor.userId
    );
  }

  if (subTab === "independent") {
    return (
      isProfessionalOrgActor(actor) &&
      !!actor.userId &&
      parcel.independent_org_id === actor.userId
    );
  }

  return isMikaActor(actor);
}
