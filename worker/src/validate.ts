export const CATEGORY_VALUES = [
  "research",
  "tools",
  "policy-advocacy",
  "funder",
  "community",
  "media",
] as const;

export const REGION_IDS = [
  "research-range",
  "power-peaks",
  "governance-grove",
  "funding-forest",
  "deliberation-delta",
  "integrity-inlet",
  "voting-village",
  "cooperation-cove",
  "backsliding-bay",
] as const;

export const UPLOAD_NAME_RE = /^u_[0-9a-f]{24}\.(png|jpeg|webp)$/;
export const ORG_SLUG_RE = /^[a-z0-9-]{1,80}$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Validation<T> = { ok: true; value: T } | { ok: false; detail: string };

function invalid<T>(detail: string): Validation<T> {
  return { ok: false, detail };
}

function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && url.host.length > 0;
}

function optStr(v: unknown): string | undefined {
  return typeof v === "string" ? v.trim() : undefined;
}

export interface SubmissionPayload {
  name: string;
  email: string | null;
  urls: string[];
  note: string;
  companyUrl: string;
  formToken: string;
  turnstileToken: string;
}

export function validateSubmission(body: unknown): Validation<SubmissionPayload> {
  if (typeof body !== "object" || body === null) return invalid("body must be an object");
  const b = body as Record<string, unknown>;
  const name = optStr(b.name);
  if (!name || name.length > 120) return invalid("name required, max 120 chars");
  const emailRaw = optStr(b.email);
  let email: string | null = null;
  if (emailRaw) {
    if (emailRaw.length > 120 || !EMAIL_RE.test(emailRaw)) return invalid("invalid email");
    email = emailRaw;
  }
  if (!Array.isArray(b.urls) || b.urls.length < 1 || b.urls.length > 5) {
    return invalid("urls must contain 1-5 entries");
  }
  const urls: string[] = [];
  for (const u of b.urls) {
    if (typeof u !== "string" || u.length > 300 || !isHttpUrl(u.trim())) {
      return invalid("each url must be an absolute http(s) URL, max 300 chars");
    }
    urls.push(u.trim());
  }
  const note = optStr(b.note);
  if (!note || note.length > 500) return invalid("note required, max 500 chars");
  return {
    ok: true,
    value: {
      name,
      email,
      urls,
      note,
      companyUrl: optStr(b.companyUrl) ?? "",
      formToken: optStr(b.formToken) ?? "",
      turnstileToken: optStr(b.turnstileToken) ?? "",
    },
  };
}

const EDIT_TEXT_LIMITS: Record<string, number> = {
  tagline: 200,
  description: 3000,
  aiDemocracyAngle: 1000,
};

export interface EditPayload {
  orgSlug: string;
  changes: Record<string, string>;
  contributorName: string | null;
  contributorEmail: string | null;
  companyUrl: string;
  formToken: string;
  turnstileToken: string;
}

export function validateEdit(body: unknown): Validation<EditPayload> {
  if (typeof body !== "object" || body === null) return invalid("body must be an object");
  const b = body as Record<string, unknown>;
  const orgSlug = optStr(b.orgSlug);
  if (!orgSlug || !ORG_SLUG_RE.test(orgSlug)) return invalid("invalid orgSlug");
  if (typeof b.changes !== "object" || b.changes === null || Array.isArray(b.changes)) {
    return invalid("changes must be an object");
  }
  const changes: Record<string, string> = {};
  for (const [key, raw] of Object.entries(b.changes as Record<string, unknown>)) {
    if (typeof raw !== "string") return invalid(`changes.${key} must be a string`);
    const value = raw.trim();
    if (key in EDIT_TEXT_LIMITS) {
      const max = EDIT_TEXT_LIMITS[key]!;
      if (!value || value.length > max) return invalid(`changes.${key} must be 1-${max} chars`);
    } else if (key === "website") {
      if (value.length > 300 || !isHttpUrl(value)) {
        return invalid("changes.website must be an absolute http(s) URL, max 300 chars");
      }
    } else if (key === "logoUpload") {
      if (!UPLOAD_NAME_RE.test(value)) return invalid("changes.logoUpload has an invalid format");
    } else {
      return invalid(`unknown changes field: ${key}`);
    }
    changes[key] = value;
  }
  if (Object.keys(changes).length === 0) return invalid("changes must contain at least one field");
  const contributorName = optStr(b.contributorName);
  if (contributorName && contributorName.length > 80) return invalid("contributorName max 80 chars");
  const contributorEmail = optStr(b.contributorEmail);
  if (contributorEmail && (contributorEmail.length > 120 || !EMAIL_RE.test(contributorEmail))) {
    return invalid("invalid contributorEmail");
  }
  return {
    ok: true,
    value: {
      orgSlug,
      changes,
      contributorName: contributorName || null,
      contributorEmail: contributorEmail || null,
      companyUrl: optStr(b.companyUrl) ?? "",
      formToken: optStr(b.formToken) ?? "",
      turnstileToken: optStr(b.turnstileToken) ?? "",
    },
  };
}

export interface KeyProject {
  name: string;
  url?: string;
  note?: string;
}

export interface OrgDraft {
  name: string;
  website: string;
  tagline: string;
  description: string;
  aiDemocracyAngle?: string;
  category: (typeof CATEGORY_VALUES)[number];
  region: (typeof REGION_IDS)[number];
  focusTags: string[];
  location?: string;
  founded?: number;
  logoUpload?: string;
  depthRing: "core" | "adjacent" | "broad";
  funders: string[];
  keyProjects: KeyProject[];
}

export function validateDraft(body: unknown): Validation<OrgDraft> {
  if (typeof body !== "object" || body === null) return invalid("body must be an object");
  const b = body as Record<string, unknown>;
  const name = optStr(b.name);
  if (!name || name.length > 120) return invalid("name required, max 120 chars");
  const website = optStr(b.website);
  if (!website || website.length > 300 || !isHttpUrl(website)) {
    return invalid("website must be an absolute http(s) URL, max 300 chars");
  }
  const tagline = optStr(b.tagline);
  if (!tagline || tagline.length > 200) return invalid("tagline required, max 200 chars");
  const description = optStr(b.description);
  if (!description || description.length > 3000) return invalid("description required, max 3000 chars");
  const aiDemocracyAngle = optStr(b.aiDemocracyAngle);
  if (aiDemocracyAngle && aiDemocracyAngle.length > 1000) return invalid("aiDemocracyAngle max 1000 chars");
  const category = optStr(b.category);
  if (!category || !(CATEGORY_VALUES as readonly string[]).includes(category)) {
    return invalid("invalid category");
  }
  const region = optStr(b.region);
  if (!region || !(REGION_IDS as readonly string[]).includes(region)) {
    return invalid("invalid region");
  }
  const focusTagsRaw = b.focusTags ?? [];
  if (!Array.isArray(focusTagsRaw) || focusTagsRaw.length > 6) return invalid("focusTags max 6 entries");
  const focusTags: string[] = [];
  for (const t of focusTagsRaw) {
    if (typeof t !== "string" || !t.trim() || t.trim().length > 40) {
      return invalid("each focus tag must be 1-40 chars");
    }
    focusTags.push(t.trim());
  }
  const location = optStr(b.location);
  if (location && location.length > 120) return invalid("location max 120 chars");
  let founded: number | undefined;
  if (b.founded !== undefined && b.founded !== null) {
    if (typeof b.founded !== "number" || b.founded < 1800 || b.founded > 2100) {
      return invalid("founded must be a year between 1800 and 2100");
    }
    founded = b.founded;
  }
  const logoUpload = optStr(b.logoUpload);
  if (logoUpload && !UPLOAD_NAME_RE.test(logoUpload)) return invalid("logoUpload has an invalid format");
  const depthRing = optStr(b.depthRing) || "core";
  if (!["core", "adjacent", "broad"].includes(depthRing)) return invalid("invalid depthRing");
  const fundersRaw = b.funders ?? [];
  if (!Array.isArray(fundersRaw)) return invalid("funders must be an array");
  const funders: string[] = [];
  for (const f of fundersRaw) {
    if (typeof f !== "string" || !f.trim() || f.trim().length > 120) {
      return invalid("each funder must be 1-120 chars");
    }
    funders.push(f.trim());
  }
  const keyProjectsRaw = b.keyProjects ?? [];
  if (!Array.isArray(keyProjectsRaw)) return invalid("keyProjects must be an array");
  const keyProjects: KeyProject[] = [];
  for (const p of keyProjectsRaw) {
    if (typeof p !== "object" || p === null) return invalid("each key project must be an object");
    const proj = p as Record<string, unknown>;
    const pname = optStr(proj.name);
    if (!pname) return invalid("each key project needs a name");
    const entry: KeyProject = { name: pname };
    const purl = optStr(proj.url);
    if (purl) {
      if (!isHttpUrl(purl)) return invalid("key project url must be an absolute http(s) URL");
      entry.url = purl;
    }
    const pnote = optStr(proj.note);
    if (pnote) entry.note = pnote;
    keyProjects.push(entry);
  }
  const value: OrgDraft = {
    name,
    website,
    tagline,
    description,
    category: category as OrgDraft["category"],
    region: region as OrgDraft["region"],
    focusTags,
    depthRing: depthRing as OrgDraft["depthRing"],
    funders,
    keyProjects,
  };
  if (aiDemocracyAngle) value.aiDemocracyAngle = aiDemocracyAngle;
  if (location) value.location = location;
  if (founded !== undefined) value.founded = founded;
  if (logoUpload) value.logoUpload = logoUpload;
  return { ok: true, value };
}
