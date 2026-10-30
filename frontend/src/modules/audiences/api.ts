"use client";

import { apiJson } from "@/lib/api-client";
import type { Audience, AudienceInput } from "@/types/audience";

/** POST /api/v1/audiences */
export function createAudience(input: AudienceInput): Promise<Audience> {
  return apiJson("POST", "/audiences", input);
}
