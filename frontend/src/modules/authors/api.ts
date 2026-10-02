"use client";

import { api, apiJson } from "@/lib/api-client";
import type { Author, AuthorInput } from "@/types/author";

/* Authors API — thin wrappers over the backend's /api/v1/authors endpoints. */

/** GET /api/v1/authors — sorted by name. */
export function listAuthors(): Promise<Author[]> {
  return api("GET", "/authors");
}

/** POST /api/v1/authors */
export function createAuthor(input: AuthorInput): Promise<Author> {
  return apiJson("POST", "/authors", input);
}

/** PUT /api/v1/authors/{id} */
export function updateAuthor(id: string, input: AuthorInput): Promise<Author> {
  return apiJson("PUT", `/authors/${id}`, input);
}

/** DELETE /api/v1/authors/{id} — the author is removed from their posts; the posts stay. */
export async function deleteAuthor(id: string): Promise<void> {
  await api("DELETE", `/authors/${id}`);
}
