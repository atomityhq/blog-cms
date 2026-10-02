"use client";

import { countWords, extractText, isDocEmpty, readingTimeMinutes } from "@/lib/content";
import { commit, getDb, latency, newId, now, type MockDb, type PostRecord } from "@/lib/mock/db";
import { authorRefs, mediaRef, tagRefs } from "@/lib/mock/relations";
import { isValidSlug, slugify } from "@/lib/slug";
import { ApiError, type Page } from "@/types/api";
import {
  POST_LIMITS,
  type Post,
  type PostInput,
  type PostListParams,
  type PostStatus,
  type PostSummary,
} from "@/types/post";

/*
 * Posts API. Each function is documented with the backend endpoint it maps to;
 * until the backend exists they run against the in-browser mock db
 * (src/lib/mock). Swapping to the real API only changes the function bodies.
 */

const DEFAULT_PAGE_SIZE = 10;

function toSummary(db: MockDb, post: PostRecord): PostSummary {
  const wordCount = countWords(post.content);
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    status: post.status,
    featured: post.featured,
    authors: authorRefs(db, post.authorIds),
    tags: tagRefs(db, post.tagIds),
    coverImage: mediaRef(db, post.coverImageId),
    wordCount,
    readingTimeMinutes: readingTimeMinutes(wordCount),
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function toPost(db: MockDb, post: PostRecord): Post {
  return {
    ...toSummary(db, post),
    content: post.content,
    coverImageAlt: post.coverImageAlt,
    seoTitle: post.seoTitle,
    metaDescription: post.metaDescription,
    focusKeyword: post.focusKeyword,
    canonicalUrl: post.canonicalUrl,
    version: post.version,
  };
}

function findOrThrow(db: MockDb, id: string): PostRecord {
  const post = db.posts.find((p) => p.id === id);
  if (!post) throw new ApiError("NOT_FOUND", "Post not found", 404);
  return post;
}

function validate(db: MockDb, input: PostInput, selfId?: string): void {
  const errors: string[] = [];
  if (input.title.length > POST_LIMITS.title) errors.push(`Title must be at most ${POST_LIMITS.title} characters`);
  if (!isValidSlug(input.slug)) errors.push("Slug may only contain lowercase letters, numbers and single hyphens");
  if (input.excerpt.length > POST_LIMITS.excerpt) errors.push(`Excerpt must be at most ${POST_LIMITS.excerpt} characters`);
  if (input.seoTitle.length > POST_LIMITS.seoTitle) errors.push(`SEO title must be at most ${POST_LIMITS.seoTitle} characters`);
  if (input.metaDescription.length > POST_LIMITS.metaDescription)
    errors.push(`Meta description must be at most ${POST_LIMITS.metaDescription} characters`);
  if (input.canonicalUrl && !/^https?:\/\/\S+$/.test(input.canonicalUrl)) errors.push("Canonical URL must start with http:// or https://");
  if (errors.length) throw new ApiError("VALIDATION_ERROR", errors.join("; "), 400);

  if (db.posts.some((p) => p.slug === input.slug && p.id !== selfId)) {
    throw new ApiError("SLUG_TAKEN", `Another post already uses the slug "${input.slug}"`, 409);
  }
}

function applyInput(post: PostRecord, input: PostInput): void {
  post.title = input.title.trim();
  post.slug = input.slug;
  post.excerpt = input.excerpt.trim();
  post.content = input.content;
  post.coverImageId = input.coverImageId;
  post.coverImageAlt = input.coverImageAlt.trim();
  post.seoTitle = input.seoTitle.trim();
  post.metaDescription = input.metaDescription.trim();
  post.focusKeyword = input.focusKeyword.trim();
  post.canonicalUrl = input.canonicalUrl.trim();
  post.featured = input.featured;
  post.authorIds = input.authorIds;
  post.tagIds = input.tagIds;
}

function matchesQuery(post: PostRecord, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    post.title.toLowerCase().includes(needle) ||
    post.excerpt.toLowerCase().includes(needle) ||
    post.slug.includes(needle) ||
    extractText(post.content).toLowerCase().includes(needle)
  );
}

/** GET /api/v1/posts?status&q&tag&author&sort&page&size */
export async function listPosts(params: PostListParams = {}): Promise<Page<PostSummary>> {
  await latency();
  const db = getDb();
  const { status, q, tagId, authorId, sort = "updatedAt", direction = "desc", page = 0, size = DEFAULT_PAGE_SIZE } = params;

  const filtered = db.posts.filter(
    (post) =>
      (!status || post.status === status) &&
      (!tagId || post.tagIds.includes(tagId)) &&
      (!authorId || post.authorIds.includes(authorId)) &&
      (!q?.trim() || matchesQuery(post, q.trim())),
  );

  const summaries = filtered.map((post) => toSummary(db, post));
  const factor = direction === "asc" ? 1 : -1;
  summaries.sort((a, b) => {
    const left = a[sort] ?? "";
    const right = b[sort] ?? "";
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
    return String(left).localeCompare(String(right)) * factor;
  });

  const totalPages = Math.max(1, Math.ceil(summaries.length / size));
  const safePage = Math.min(page, totalPages - 1);
  return {
    items: summaries.slice(safePage * size, safePage * size + size),
    meta: { page: safePage, size, totalElements: summaries.length, totalPages },
  };
}

/** GET /api/v1/posts/counts — number of posts per status, for the list tabs. */
export async function countPostsByStatus(): Promise<Record<PostStatus | "ALL", number>> {
  await latency(60);
  const posts = getDb().posts;
  return {
    ALL: posts.length,
    DRAFT: posts.filter((p) => p.status === "DRAFT").length,
    PUBLISHED: posts.filter((p) => p.status === "PUBLISHED").length,
    ARCHIVED: posts.filter((p) => p.status === "ARCHIVED").length,
  };
}

/** GET /api/v1/posts/{id} */
export async function getPost(id: string): Promise<Post> {
  await latency();
  const db = getDb();
  return toPost(db, findOrThrow(db, id));
}

/** POST /api/v1/posts — new posts always start as drafts. */
export async function createPost(input: PostInput): Promise<Post> {
  await latency(250);
  const db = getDb();
  validate(db, input);
  const timestamp = now();
  const post: PostRecord = {
    id: newId(),
    title: "",
    slug: "",
    excerpt: "",
    content: input.content,
    status: "DRAFT",
    featured: false,
    coverImageId: null,
    coverImageAlt: "",
    seoTitle: "",
    metaDescription: "",
    focusKeyword: "",
    canonicalUrl: "",
    authorIds: [],
    tagIds: [],
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  applyInput(post, input);
  db.posts.unshift(post);
  commit();
  return toPost(db, post);
}

/**
 * PUT /api/v1/posts/{id}
 * `version` is the one the editor loaded; a mismatch means someone else saved in
 * between, and the save is rejected rather than silently overwriting their work.
 */
export async function updatePost(id: string, input: PostInput, version: number): Promise<Post> {
  await latency(250);
  const db = getDb();
  const post = findOrThrow(db, id);
  if (post.version !== version) {
    throw new ApiError("VERSION_CONFLICT", "This post was changed somewhere else since you opened it. Reload to get the latest version.", 409);
  }
  validate(db, input, id);
  applyInput(post, input);
  post.updatedAt = now();
  post.version += 1;
  commit();
  return toPost(db, post);
}

/** POST /api/v1/posts/{id}/publish — requires a title, slug and body. */
export async function publishPost(id: string): Promise<Post> {
  await latency(250);
  const db = getDb();
  const post = findOrThrow(db, id);
  const missing = [
    !post.title.trim() && "a title",
    !post.slug && "a slug",
    isDocEmpty(post.content) && "some content",
  ].filter(Boolean);
  if (missing.length) {
    throw new ApiError("NOT_PUBLISHABLE", `Add ${missing.join(", ")} before publishing.`, 422);
  }
  return setStatus(db, post, "PUBLISHED");
}

/** POST /api/v1/posts/{id}/unpublish — back to draft (also restores archived posts). */
export async function unpublishPost(id: string): Promise<Post> {
  await latency(200);
  const db = getDb();
  return setStatus(db, findOrThrow(db, id), "DRAFT");
}

/** POST /api/v1/posts/{id}/archive */
export async function archivePost(id: string): Promise<Post> {
  await latency(200);
  const db = getDb();
  return setStatus(db, findOrThrow(db, id), "ARCHIVED");
}

function setStatus(db: MockDb, post: PostRecord, status: PostStatus): Post {
  post.status = status;
  // First publication date is kept across unpublish/republish, like the backend will.
  if (status === "PUBLISHED" && !post.publishedAt) post.publishedAt = now();
  post.updatedAt = now();
  post.version += 1;
  commit();
  return toPost(db, post);
}

/** POST /api/v1/posts/{id}/duplicate — copies content and metadata into a new draft. */
export async function duplicatePost(id: string): Promise<Post> {
  await latency(250);
  const db = getDb();
  const source = findOrThrow(db, id);
  let slug = `${source.slug}-copy`;
  for (let n = 2; db.posts.some((p) => p.slug === slug); n++) slug = `${source.slug}-copy-${n}`;
  const timestamp = now();
  const copy: PostRecord = {
    ...structuredClone(source),
    id: newId(),
    title: `${source.title} (copy)`.slice(0, POST_LIMITS.title),
    slug: slugify(slug),
    status: "DRAFT",
    featured: false,
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  db.posts.unshift(copy);
  commit();
  return toPost(db, copy);
}

/** DELETE /api/v1/posts/{id} */
export async function deletePost(id: string): Promise<void> {
  await latency(200);
  const db = getDb();
  findOrThrow(db, id);
  db.posts = db.posts.filter((p) => p.id !== id);
  commit();
}
