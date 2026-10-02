"use client";

import type { ContentDoc } from "@/types/content";
import type { PostStatus } from "@/types/post";
import { createSeed } from "./seed";

/*
 * In-browser stand-in for the backend's database, used until the API exists.
 *
 * Records are stored normalised (relations as ids), the way the backend's tables
 * hold them; the modules' api.ts functions join them into the response shapes in
 * src/types. Everything persists to localStorage, so edits survive a reload.
 */

export interface PostRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: ContentDoc;
  status: PostStatus;
  featured: boolean;
  coverImageId: string | null;
  coverImageAlt: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  authorIds: string[];
  tagIds: string[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface AuthorRecord {
  id: string;
  name: string;
  slug: string;
  bio: string;
  avatarId: string | null;
  createdAt: string;
}

export interface TagRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface MediaRecord {
  id: string;
  url: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  altText: string;
  createdAt: string;
}

export interface MockDb {
  posts: PostRecord[];
  authors: AuthorRecord[];
  tags: TagRecord[];
  media: MediaRecord[];
}

/** Bump when the record shapes change so stale browser copies are re-seeded. */
const STORAGE_KEY = "blog-crm:mock-db:v1";

let cache: MockDb | null = null;

export function getDb(): MockDb {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as MockDb) : createSeed();
  } catch {
    cache = createSeed();
  }
  return cache;
}

/**
 * Persists the whole db. Uploaded images are stored inline as data URLs, so a
 * large library can exceed the browser's ~5 MB localStorage quota — that surfaces
 * as an error to the caller instead of silently losing the change on reload.
 */
export function commit(): void {
  if (!cache) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    throw new Error("Browser storage is full. Delete some images from the media library and try again.");
  }
}

/** Throws away every local change and restores the sample data. */
export function resetDb(): void {
  cache = createSeed();
  commit();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

/** Simulated network latency, so loading states are visible in the mockup. */
export function latency(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
