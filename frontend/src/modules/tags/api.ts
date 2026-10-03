"use client";

import { api, apiJson } from "@/lib/api-client";
import type { Tag, TagInput } from "@/types/tag";

/* Tags API — thin wrappers over the backend's /api/v1/tags endpoints. */

/** GET /api/v1/tags — sorted by name. */
export function listTags(): Promise<Tag[]> {
  return api("GET", "/tags");
}

/** POST /api/v1/tags */
export function createTag(input: TagInput): Promise<Tag> {
  return apiJson("POST", "/tags", input);
}

/** PUT /api/v1/tags/{id} */
export function updateTag(id: string, input: TagInput): Promise<Tag> {
  return apiJson("PUT", `/tags/${id}`, input);
}

/** DELETE /api/v1/tags/{id} — removed from every post that had it. */
export async function deleteTag(id: string): Promise<void> {
  await api("DELETE", `/tags/${id}`);
}
