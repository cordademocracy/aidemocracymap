import type {
  Category,
  DepthRing,
  KeyProject,
  Organization,
  OrgSummary,
  RegionId,
} from "../data/types";
import orgsJson from "../data/organizations.json";
import { searchOrgs } from "./orgs";

/**
 * API client for the AI4Democracy map.
 *
 * Org data is baked into the bundle at build time; only the contribution and
 * admin flows talk to the Worker (dev: wrangler dev on :8787, prod: same-origin
 * /api). Every call has an 8s timeout and, on failure, throws an ApiError
 * carrying the HTTP status so the UI can special-case 401 / 429 / etc.
 * Network/timeout failures use status 0.
 */
export const API_BASE = import.meta.env.DEV ? "http://localhost:8787/api" : "/api";

/** The three free-text org fields a contributor may propose changes to. */
export type EditableField = "tagline" | "description" | "aiDemocracyAngle";

export type EditStatus = "pending" | "approved" | "rejected";

/**
 * The full set of fields an edit may carry. Beyond the three free-text fields
 * (v1), v1.1 adds `website` (an absolute http(s) URL) and `logoUpload` (an
 * upload id from POST /api/uploads, applied to the org's logoUrl on approve).
 */
export interface EditChanges {
  tagline?: string;
  description?: string;
  aiDemocracyAngle?: string;
  website?: string;
  logoUpload?: string;
}

/** An edit as returned by the admin endpoint (with before/after values). */
export interface EditSuggestion {
  id: number;
  orgSlug: string;
  orgName: string;
  changes: EditChanges;
  current: EditChanges;
  contributorName: string | null;
  contributorEmail: string | null;
  status: EditStatus;
  createdAt: string;
}

/** Payload for POST /api/edits — only changed fields belong in `changes`.
 * `formToken` comes from GET /api/form-token; `companyUrl` is the honeypot
 * field and must stay empty for real people. `turnstileToken` is the
 * Turnstile response ("" when no site key is configured). */
export interface SubmitEditPayload {
  formToken: string;
  turnstileToken: string;
  companyUrl?: string;
  orgSlug: string;
  changes: EditChanges;
  contributorName?: string;
  contributorEmail?: string;
}

export interface SubmitEditResult {
  id: number;
  status: string;
}

/** Result of POST /api/uploads — an upload id plus its URL. */
export interface UploadResult {
  id: string;
  url: string;
}

/** The full-org draft shape shared by grandfathered v1 submissions and the
 * admin draft editor. */
export interface NewOrgDraft {
  name: string;
  website: string;
  tagline: string;
  description: string;
  aiDemocracyAngle?: string;
  category: Category;
  region: RegionId;
  focusTags: string[];
  location?: string;
  founded?: number | null;
  logoUpload?: string;
}

/** Payload for POST /api/submissions — the lean public proposal (v2). */
export interface SubmitOrgPayload {
  name: string;
  email?: string;
  urls: string[];
  note: string;
  companyUrl?: string;
  formToken: string;
  turnstileToken: string;
}

/** Everything a draft needs before approve — NewOrgDraft plus the admin-only fields. */
export interface NewOrgDraftFull extends NewOrgDraft {
  depthRing: DepthRing;
  funders: string[];
  keyProjects: KeyProject[];
}

/** The lean shape stored by the v2 public form (discriminated by `v`). */
export interface SubmissionV2Org {
  v: 2;
  name: string;
  email: string | null;
  urls: string[];
  note: string | null;
}

/** A new-org submission as returned by the admin endpoint. Rows without
 * `org.v` are grandfathered v1 full-org drafts. */
export interface OrgSubmission {
  id: number;
  org: NewOrgDraft | SubmissionV2Org;
  draft: NewOrgDraftFull | null;
  contributorName: string | null;
  contributorEmail: string | null;
  status: EditStatus;
  createdAt: string;
}

export function isV2Org(org: OrgSubmission["org"]): org is SubmissionV2Org {
  return (org as SubmissionV2Org).v === 2;
}

/**
 * Thrown by every client call. `status` is the HTTP status code, or 0 for
 * network/timeout failures so the UI can tell "backend unreachable" apart from
 * "not authorized".
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TIMEOUT_MS = 8000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(0, aborted ? "Request timed out" : "Network error");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new ApiError(res.status, await errorMessage(res));
  }
  return (await res.json()) as T;
}

/** Best-effort human message from an API error body ({detail: ...}). */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && typeof body.detail[0]?.msg === "string") {
      return body.detail[0].msg;
    }
  } catch {
    /* non-JSON error body — fall through to the status text */
  }
  return res.statusText || `HTTP ${res.status}`;
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const ORGS = orgsJson as Organization[];

function toSummary(org: Organization): OrgSummary {
  return {
    slug: org.slug,
    name: org.name,
    website: org.website,
    category: org.category,
    region: org.region,
    tagline: org.tagline,
    focusTags: org.focusTags,
    location: org.location,
    depthRing: org.depthRing,
    logoUrl: org.logoUrl ?? null,
  };
}

/** GET /api/form-token — signed token the public forms echo back on submit.
 * Fetched on mount; it doubles as the server's minimum-fill-time anchor. */
export function fetchFormToken(): Promise<{ token: string }> {
  return request<{ token: string }>("/form-token");
}

/** Org summaries (D13) from the baked dataset, optionally filtered by
 * keyword/category. Kept promise-shaped so callers are agnostic to the source. */
export function fetchOrgs(q?: string, category?: string): Promise<OrgSummary[]> {
  return Promise.resolve(
    searchOrgs(ORGS.map(toSummary), q ?? "", category as Category | undefined)
  );
}

/** One org from the baked dataset (unknown slug → ApiError with status 404). */
export function fetchOrg(slug: string): Promise<Organization> {
  const org = ORGS.find((o) => o.slug === slug);
  return org
    ? Promise.resolve(org)
    : Promise.reject(new ApiError(404, "Organization not found"));
}

/** POST /api/edits — submit a contributor edit suggestion. */
export function submitEdit(payload: SubmitEditPayload): Promise<SubmitEditResult> {
  return request<SubmitEditResult>("/edits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** POST /api/admin/login — mails a one-time login link to the maintainer
 * inbox. Always resolves: the API never reveals whether mail went out. */
export function adminRequestLoginLink(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/admin/login", { method: "POST" });
}

/** Wire shape of GET /api/admin/edits — the Worker holds no org data, so
 * `orgName` and `current` are resolved here from the baked dataset. */
type EditSuggestionRow = Omit<EditSuggestion, "orgName" | "current">;

function currentValues(org: Organization | undefined): EditChanges {
  if (!org) return {};
  return {
    tagline: org.tagline,
    description: org.description,
    aiDemocracyAngle: org.aiDemocracyAngle,
    website: org.website,
  };
}

/** GET /api/admin/edits?status= — admin-only (session cookie). */
export async function adminListEdits(status: EditStatus): Promise<EditSuggestion[]> {
  const rows = await request<EditSuggestionRow[]>(`/admin/edits${qs({ status })}`);
  return rows.map((row) => {
    const org = ORGS.find((o) => o.slug === row.orgSlug);
    return { ...row, orgName: org?.name ?? row.orgSlug, current: currentValues(org) };
  });
}

/** POST /api/admin/edits/{id}/{approve|reject} — resolve a pending edit. */
export function adminResolve(
  id: number,
  action: "approve" | "reject"
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/admin/edits/${id}/${action}`, {
    method: "POST",
  });
}

/**
 * POST /api/uploads — upload an image (multipart) with a form token. The
 * FormData body sets its own multipart Content-Type, so we don't add one.
 * Surfaces 413 (too big) / 415 (not an image) / 429 as ApiError.
 */
export function uploadImage(formToken: string, file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("formToken", formToken);
  form.append("file", file);
  return request<UploadResult>("/uploads", { method: "POST", body: form });
}

/** POST /api/submissions — propose a brand-new organization. */
export function submitNewOrg(payload: SubmitOrgPayload): Promise<SubmitEditResult> {
  return request<SubmitEditResult>("/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** GET /api/admin/submissions?status= — admin-only (session cookie). */
export function adminListSubmissions(status: EditStatus): Promise<OrgSubmission[]> {
  return request<OrgSubmission[]>(`/admin/submissions${qs({ status })}`);
}

/** POST /api/admin/submissions/{id}/draft — save the enriched full-org draft.
 * A v2 submission needs a saved draft before approve (else the API 409s). */
export function adminSaveSubmissionDraft(
  id: number,
  draft: NewOrgDraftFull
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/admin/submissions/${id}/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
}

/**
 * POST /api/admin/submissions/{id}/{approve|reject} — resolve a submission.
 * Approve is triage only: the entry goes live via the local audit pipeline →
 * organizations.json → deploy, not through this API.
 */
export function adminResolveSubmission(
  id: number,
  action: "approve" | "reject"
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/admin/submissions/${id}/${action}`, {
    method: "POST",
  });
}
