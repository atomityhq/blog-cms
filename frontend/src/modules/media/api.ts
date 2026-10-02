"use client";

import { commit, getDb, latency, newId, now, type MediaRecord, type MockDb } from "@/lib/mock/db";
import { mediaUsageCount } from "@/lib/mock/relations";
import { ApiError } from "@/types/api";
import type { Media } from "@/types/media";
import { prepareImage } from "./upload";

/* Media API — see modules/posts/api.ts for how the mock maps to the backend. */

function toMedia(db: MockDb, media: MediaRecord): Media {
  return { ...media, usageCount: mediaUsageCount(db, media.id) };
}

/** GET /api/v1/media — newest first. */
export async function listMedia(): Promise<Media[]> {
  await latency(150);
  const db = getDb();
  return db.media
    .map((m) => toMedia(db, m))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * POST /api/v1/media (multipart). The backend stores the file on disk; the mock
 * keeps a downscaled data URL instead (see ./upload.ts).
 */
export async function uploadMedia(file: File): Promise<Media> {
  const image = await prepareImage(file);
  await latency(300);
  const db = getDb();
  const record: MediaRecord = {
    id: newId(),
    url: image.dataUrl,
    originalFilename: file.name,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    width: image.width,
    height: image.height,
    altText: "",
    createdAt: now(),
  };
  db.media.unshift(record);
  try {
    commit();
  } catch (error) {
    db.media.shift();
    throw new ApiError("STORAGE_FULL", (error as Error).message, 507);
  }
  return toMedia(db, record);
}

/** PATCH /api/v1/media/{id} */
export async function updateMediaAlt(id: string, altText: string): Promise<Media> {
  await latency(150);
  const db = getDb();
  const media = db.media.find((m) => m.id === id);
  if (!media) throw new ApiError("NOT_FOUND", "Image not found", 404);
  if (altText.length > 300) throw new ApiError("VALIDATION_ERROR", "Alt text must be at most 300 characters", 400);
  media.altText = altText.trim();
  commit();
  return toMedia(db, media);
}

/** DELETE /api/v1/media/{id} — refused while any post or author still uses the image. */
export async function deleteMedia(id: string): Promise<void> {
  await latency(200);
  const db = getDb();
  const usage = mediaUsageCount(db, id);
  if (usage > 0) {
    throw new ApiError("MEDIA_IN_USE", `This image is used in ${usage} place${usage === 1 ? "" : "s"}. Remove it there first.`, 409);
  }
  db.media = db.media.filter((m) => m.id !== id);
  commit();
}
