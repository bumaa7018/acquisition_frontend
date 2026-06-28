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
export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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
): boolean {
  if (subTab === "mika") {
    return isMikaActor(actor) || isFinanceSpecialistActor(actor);
  }

  return (
    isProfessionalOrgActor(actor) ||
    isMikaActor(actor) ||
    isFinanceSpecialistActor(actor)
  );
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

function cleanApiPath(path: string): string {
  const withoutOrigin = path.replace(/^https?:\/\/[^/]+/i, "");
  return withoutOrigin.split("?")[0].replace(/\/+$/, "") || "/";
}

function matches(path: string, pattern: RegExp): boolean {
  return pattern.test(cleanApiPath(path));
}

export function canCallApiEndpointForActor(
  actor: AccessActor,
  method: ApiMethod | string | undefined,
  path: string,
): boolean {
  const apiMethod = (method ?? "GET").toUpperCase() as ApiMethod;
  const apiPath = cleanApiPath(path);

  // Asset and compensation mutations are restricted to professional_org only.
  // This check runs before the internal-user bypass so admins cannot mutate these.
  if (["POST", "PUT", "DELETE"].includes(apiMethod)) {
    if (
      matches(apiPath, /^\/land-acquisitions\/[^/]+\/assets(\/[^/]+)?$/) ||
      matches(apiPath, /^\/land-acquisitions\/[^/]+\/compensations(\/[^/]+(\/grant)?)?$/)
    ) {
      return isProfessionalOrgActor(actor);
    }
    // Funding source mutations: only senior_specialist
    if (matches(apiPath, /^\/land-acquisitions\/[^/]+\/funding-sources(\/[^/]+)?$/)) {
      return isSeniorSpecialistActor(actor);
    }
  }

  if (!isExternalSpecialActor(actor)) return true;

  if (matches(apiPath, /^\/auth\/(login|logout|refresh)$/)) return true;
  if (apiMethod === "GET" && apiPath === "/users/me") return true;

  if (apiMethod === "GET") {
    if (apiPath === "/acquisition-categories") return true;
    if (apiPath === "/land-acquisitions") return true;
    if (matches(apiPath, /^\/land-acquisitions\/[^/]+$/)) return true;
    if (matches(apiPath, /^\/land-acquisitions\/[^/]+\/parcels$/)) return true;
    if (matches(apiPath, /^\/land-acquisitions\/[^/]+\/parcels\/[^/]+$/)) return true;
    if (matches(apiPath, /^\/land-acquisitions\/[^/]+\/parcels\/[^/]+\/representatives$/)) return true;
    if (matches(apiPath, /^\/land-acquisitions\/[^/]+\/assets$/)) return true;
    if (matches(apiPath, /^\/land-acquisitions\/[^/]+\/compensations$/)) return true;
  }

  if (isProfessionalOrgActor(actor)) {
    if (
      ["POST", "PUT", "DELETE"].includes(apiMethod) &&
      matches(apiPath, /^\/land-acquisitions\/[^/]+\/assets(\/[^/]+)?$/)
    ) {
      return true;
    }
  }

  if (isMikaActor(actor)) {
    if (
      apiMethod === "PATCH" &&
      matches(apiPath, /^\/land-acquisitions\/[^/]+\/parcels\/[^/]+\/valuation$/)
    ) {
      return true;
    }
  }

  return false;
}
