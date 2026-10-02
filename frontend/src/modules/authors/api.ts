"use client";

import { commit, getDb, latency, newId, now, type AuthorRecord, type MockDb } from "@/lib/mock/db";
import { mediaRef } from "@/lib/mock/relations";
import { isValidSlug } from "@/lib/slug";
import { ApiError } from "@/types/api";
import type { Author, AuthorInput } from "@/types/author";

/* Authors API — see modules/posts/api.ts for how the mock maps to the backend. */

function toAuthor(db: MockDb, author: AuthorRecord): Author {
  return {
    id: author.id,
    name: author.name,
    slug: author.slug,
    bio: author.bio,
    avatar: mediaRef(db, author.avatarId),
    postCount: db.posts.filter((post) => post.authorIds.includes(author.id)).length,
    createdAt: author.createdAt,
  };
}

function validate(db: MockDb, input: AuthorInput, selfId?: string): void {
  if (!input.name.trim()) throw new ApiError("VALIDATION_ERROR", "Name is required", 400);
  if (input.name.length > 100) throw new ApiError("VALIDATION_ERROR", "Name must be at most 100 characters", 400);
  if (input.bio.length > 500) throw new ApiError("VALIDATION_ERROR", "Bio must be at most 500 characters", 400);
  if (!isValidSlug(input.slug)) {
    throw new ApiError("VALIDATION_ERROR", "Slug may only contain lowercase letters, numbers and single hyphens", 400);
  }
  if (db.authors.some((a) => a.slug === input.slug && a.id !== selfId)) {
    throw new ApiError("SLUG_TAKEN", `Another author already uses the slug "${input.slug}"`, 409);
  }
}

/** GET /api/v1/authors */
export async function listAuthors(): Promise<Author[]> {
  await latency(120);
  const db = getDb();
  return db.authors.map((a) => toAuthor(db, a)).sort((a, b) => a.name.localeCompare(b.name));
}

/** POST /api/v1/authors */
export async function createAuthor(input: AuthorInput): Promise<Author> {
  await latency(200);
  const db = getDb();
  validate(db, input);
  const author: AuthorRecord = {
    id: newId(),
    name: input.name.trim(),
    slug: input.slug,
    bio: input.bio.trim(),
    avatarId: input.avatarId,
    createdAt: now(),
  };
  db.authors.push(author);
  commit();
  return toAuthor(db, author);
}

/** PUT /api/v1/authors/{id} */
export async function updateAuthor(id: string, input: AuthorInput): Promise<Author> {
  await latency(200);
  const db = getDb();
  const author = db.authors.find((a) => a.id === id);
  if (!author) throw new ApiError("NOT_FOUND", "Author not found", 404);
  validate(db, input, id);
  author.name = input.name.trim();
  author.slug = input.slug;
  author.bio = input.bio.trim();
  author.avatarId = input.avatarId;
  commit();
  return toAuthor(db, author);
}

/** DELETE /api/v1/authors/{id} — the author is removed from their posts; the posts stay. */
export async function deleteAuthor(id: string): Promise<void> {
  await latency(200);
  const db = getDb();
  db.authors = db.authors.filter((a) => a.id !== id);
  db.posts.forEach((post) => {
    post.authorIds = post.authorIds.filter((authorId) => authorId !== id);
  });
  commit();
}
