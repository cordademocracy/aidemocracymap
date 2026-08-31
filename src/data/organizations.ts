import type { Organization } from "./types";
import raw from "./organizations.json";

/** Full-org dataset, baked into the bundle at build time (D8). */
export async function loadSnapshot(): Promise<Organization[]> {
  return raw as Organization[];
}
