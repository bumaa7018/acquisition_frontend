// Хуучин мэдээллийн импортын хуудасны API — backend-ийн `/api/v1/legacy-import/*`
// (government: internal/legacyimport). Файл шалгах, түр хүснэгт, ГУС дуудлага,
// «Оруулах» бүгд BACKEND дээр; frontend зөвхөн дэлгэц. Төрлүүд нь
// internal/legacyimport/types.go-той ИЖИЛ.
import api from "@/lib/api";

export interface Issue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface FileInfo {
  name: string;
  features: number;
  issues: Issue[];
}

export interface BoundaryView {
  categories: { general: { id: number; name: string }; sub: { id: number; name: string } | null } | null;
  files: FileInfo[];
  rows: {
    idx: number;
    file: string;
    planParcelID: string;
    name: string;
    planCode: string;
    planFound: boolean;
    areaM2: number | null;
    insidePlanPct: number | null;
    existing: boolean;
    issues: Issue[];
  }[];
  map: { idx: number; boundary: string; plan: string | null }[];
  errors: number;
  warnings: number;
  canProceed: boolean;
}

export type GusOrigin = "info" | "ub" | "missing" | "failed" | "skip" | "pending";

export interface ParcelRow {
  idx: number;
  file: string;
  parcelID: string;
  oldParcelID: string;
  synthetic: boolean;
  sourceCode: number | null;
  status: number;
  statusMapped: boolean;
  areaM2: number | null;
  boundaryIdx: number | null;
  insidePct: number | null;
  outside: boolean;
  nearestDistanceM: number | null;
  alreadyImported: boolean;
  gus: GusOrigin;
  issues: Issue[];
}

export interface ParcelView {
  files: FileInfo[];
  rows: ParcelRow[];
  stats: {
    total: number;
    synthetic: number;
    duplicates: number;
    noGeometry: number;
    unmappedCodes: Record<string, number>;
    alreadyImported: number;
    outside: number;
    partlyOutside: number;
    gus: Record<GusOrigin, number>;
  };
  map: { idx: number; parcelID: string; wkt: string; outside: boolean }[];
  errors: number;
  warnings: number;
  gusDone: boolean;
  canProceed: boolean;
}

export interface ReportRow {
  idx: number;
  file: string;
  sheet: string;
  excelRow: number;
  parcelID: string;
  oldParcelID: string;
  holderName: string;
  totalAmount: number;
  affectedAreaM2: number | null;
  shpAreaM2: number | null;
  match: "staged" | "db" | "gus" | "missing" | "pending";
  gusOrigin: "info" | "ub" | null;
  issues: Issue[];
}

export interface ReportView {
  files: FileInfo[];
  rows: ReportRow[];
  parcelsWithoutReport: { parcelID: string; file: string }[];
  stats: {
    rows: number;
    staged: number;
    db: number;
    gus: number;
    gusFromUb: number;
    missing: number;
    pending: number;
    withoutReport: number;
    totalAmount: number;
    missingAmount: number;
    areaDiffs: number;
    balanced: number;
    duplicates: number;
  };
  errors: number;
  warnings: number;
  gusDone: boolean;
  canProceed: boolean;
}

export interface Summary {
  acquisitions: {
    idx: number;
    planParcelID: string;
    name: string;
    areaM2: number | null;
    existing: boolean;
    parcels: number;
    outside: number;
    reportRows: number;
  }[];
  parcels: ParcelView["stats"] | null;
  reports: ReportView["stats"] | null;
  parcelsWithoutReport: number;
  blockers: string[];
  cautions: string[];
  canCommit: boolean;
}

export interface CommitResult {
  error?: string;
  committedAt?: string;
  acquisitions?: { created: number; updated: number; names: string[] };
  parcels?: { imported: number; alreadyImported: number; gusMissing: number; fromUb: number; nearest: number };
  compensations?: { applied: number; totalAmount: number; missingParcels: number } | null;
  acquisitionStatuses?: { verified: number; field: number; changed: number };
  log?: {
    success: number;
    skipped: number;
    failed: number;
    warnings: number;
    entries?: { level: "skipped" | "failed" | "warning"; stage: string; key: string; message: string }[];
  };
}

export interface Job {
  kind: "parcels" | "reports" | "commit";
  state: "running" | "done" | "failed";
  done: number;
  total: number;
  error?: string;
}

export interface ImportState {
  session: {
    id: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    status: "draft" | "committing" | "committed" | "failed" | "rolled_back";
    category: { general: string; sub: string } | null;
    rollback?: RollbackResult;
  };
  boundary: BoundaryView | null;
  parcels: ParcelView | null;
  reports: ReportView | null;
  result: CommitResult | null;
  summary: Summary;
  job: Job | null;
  /** «Устгах»-ын түүх. */
  rollbackLog: RollbackLogEntry[] | null;
}

export interface SessionListItem {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: ImportState["session"]["status"];
  acquisitions: number;
  parcels: number;
  reportRows: number;
  /** Оруулсан бөгөөд импортын бүртгэл (устгах жагсаалт) нь байгаа эсэх. */
  deletable: boolean;
  rollback?: RollbackResult;
}

export interface RollbackCount {
  total: number;
  exists: number;
  missing: number;
}

/** «Устгах»-ын өмнө юу устах, юу үлдэхийг харуулна. */
export interface RollbackPreview {
  acquisitions: {
    id: string;
    name: string;
    exists: boolean;
    /** Импортоос өөр мэдээлэлтэй тул чөлөөлөлт ҮЛДЭНЭ. */
    keep: boolean;
    keepReason?: string;
    /** Үлдэх (импортоос өөр) нэгж талбарууд. */
    others: string[];
  }[];
  parcels: RollbackCount;
  valuations: RollbackCount;
  compensations: number;
  amount: number;
  decisionLinks: number;
  /** Импортын нэгж талбарт дараа нь хүн нэмсэн мөр — мөн устана. */
  addedLater: Record<string, number>;
  blockers: string[];
  canRollback: boolean;
}

export interface RollbackResult {
  at: string;
  by: string;
  acquisitions: string[];
  kept: string[];
  /** "<action>:<kind>" → тоо */
  counts: Record<string, number>;
  files: number;
  fileErrors: number;
}

export interface RollbackLogEntry {
  at: string;
  by: string;
  step: "valuation" | "parcel" | "acquisition" | "file" | "rollback";
  kind: string;
  refID: string;
  label: string;
  action: "deleted" | "detached" | "skipped" | "kept" | "failed";
  message: string;
}

export interface Category {
  id: number;
  name: string;
  parentId: number | null;
}

/** Backend-ийн алдааны мессежийг (error/message) хэрэглэгчид харуулна. */
function apiError(err: unknown): Error {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return new Error(data?.error || data?.message || (err instanceof Error ? err.message : "Алдаа гарлаа"));
}

async function call<T>(promise: Promise<{ data: { data?: T } }>): Promise<T> {
  try {
    return (await promise).data.data as T;
  } catch (err) {
    throw apiError(err);
  }
}

// SHP/эксэл уншиж, ГУС-аас төлөвлөгөө шалгах нь удаан байж болно.
const UPLOAD_TIMEOUT_MS = 300_000;

function upload(path: string, files: File[], fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const file of files) form.append("files", file, file.name);
  return call<ImportState>(api.post(`/legacy-import/${path}`, form, { timeout: UPLOAD_TIMEOUT_MS }));
}

export const legacyImportApi = {
  categories: () => call<Category[]>(api.get("/legacy-import/categories")),
  sessions: () => call<SessionListItem[]>(api.get("/legacy-import/sessions")),
  create: () => call<{ id: string }>(api.post("/legacy-import/sessions")),
  // silent — дэлгэцийн бүтэн loader-гүй (давтан шинэчлэлт).
  get: (id: string, silent = false) => call<ImportState>(api.get(`/legacy-import/sessions/${id}`, { _silent: silent })),
  /** Арын ажлын явц — хөнгөн, loader-гүй; ажил явж байх үед давтан дуудна. */
  progress: (id: string) =>
    call<{ status: ImportState["session"]["status"]; job: Job | null }>(
      api.get(`/legacy-import/sessions/${id}/progress`, { _silent: true }),
    ),
  remove: (id: string) => call<{ id: string }>(api.delete(`/legacy-import/sessions/${id}`)),
  boundary: (id: string, files: File[], category: string, subCategory: string) =>
    upload(`sessions/${id}/boundary`, files, { category, subCategory }),
  parcels: (id: string, files: File[]) => upload(`sessions/${id}/parcels`, files),
  reports: (id: string, files: File[]) => upload(`sessions/${id}/reports`, files),
  commit: (id: string) => call<{ id: string; status: string }>(api.post(`/legacy-import/sessions/${id}/commit`)),
  rollbackPreview: (id: string) => call<RollbackPreview>(api.get(`/legacy-import/sessions/${id}/rollback`)),
  // confirm — импортын дугаар: санамсаргүй дуудлагаас хамгаална.
  rollback: (id: string) =>
    call<RollbackResult>(api.post(`/legacy-import/sessions/${id}/rollback`, { confirm: id }, { timeout: UPLOAD_TIMEOUT_MS })),
};

/** Мөнгөн дүн / талбай — Монгол бичлэгээр. */
export const fmt = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined ? "—" : value.toLocaleString("mn-MN", { maximumFractionDigits: digits });
