"use client";

import { commit, getDb, latency, newId, now, type MockDb, type TagRecord } from "@/lib/mock/db";
import { isValidSlug } from "@/lib/slug";
import { ApiError } from "@/types/api";
import type { Tag, TagInput } from "@/types/tag";

/* Tags API — see modules/posts/api.ts for how the mock maps to the backend. */

function toTag(db: MockDb, tag: TagRecord): Tag {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    postCount: db.posts.filter((post) => post.tagIds.includes(tag.id)).length,
    createdAt: tag.createdAt,
  };
}

function validate(db: MockDb, input: TagInput, selfId?: string): void {
  if (!input.name.trim()) throw new ApiError("VALIDATION_ERROR", "Name is required", 400);
  if (input.name.length > 60) throw new ApiError("VALIDATION_ERROR", "Name must be at most 60 characters", 400);
  if (!isValidSlug(input.slug)) {
    throw new ApiError("VALIDATION_ERROR", "Slug may only contain lowercase letters, numbers and single hyphens", 400);
  }
  if (db.tags.some((t) => t.slug === input.slug && t.id !== selfId)) {
    throw new ApiError("SLUG_TAKEN", `A tag with the slug "${input.slug}" already exists`, 409);
  }
}

/** GET /api/v1/tags */
export async function listTags(): Promise<Tag[]> {
  await latency(120);
  const db = getDb();
  return db.tags.map((t) => toTag(db, t)).sort((a, b) => a.name.localeCompare(b.name));
}

/** POST /api/v1/tags */
export async function createTag(input: TagInput): Promise<Tag> {
  await latency(150);
  const db = getDb();
  validate(db, input);
  const tag: TagRecord = { id: newId(), name: input.name.trim(), slug: input.slug, createdAt: now() };
  db.tags.push(tag);
  commit();
  return toTag(db, tag);
}

/** PUT /api/v1/tags/{id} */
export async function updateTag(id: string, input: TagInput): Promise<Tag> {
  await latency(150);
  const db = getDb();
  const tag = db.tags.find((t) => t.id === id);
  if (!tag) throw new ApiError("NOT_FOUND", "Tag not found", 404);
  validate(db, input, id);
  tag.name = input.name.trim();
  tag.slug = input.slug;
  commit();
  return toTag(db, tag);
}

/** DELETE /api/v1/tags/{id} — removed from every post that had it. */
export async function deleteTag(id: string): Promise<void> {
  await latency(150);
  const db = getDb();
  db.tags = db.tags.filter((t) => t.id !== id);
  db.posts.forEach((post) => {
    post.tagIds = post.tagIds.filter((tagId) => tagId !== id);
  });
  commit();
}
