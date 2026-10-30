"use client";

import { api, apiJson } from "@/lib/api-client";
import type { Audience, AudienceInput } from "@/types/audience";

/** POST /api/v1/audiences */
export function createAudience(input: AudienceInput): Promise<Audience> {
  return apiJson("POST", "/audiences", input);
}

/** GET /api/v1/audiences, sorted by name. */
export function listAudiences(): Promise<Audience[]> {
  return api("GET", "/audiences");
}

/** PUT /api/v1/audiences/{id} */
export function updateAudience(id: string, input: AudienceInput): Promise<Audience> {
  return apiJson("PUT", `/audiences/${id}`, input);
}
