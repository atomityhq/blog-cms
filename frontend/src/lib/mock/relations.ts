"use client";

import { collectImageIds } from "@/lib/content";
import type { AuthorRef } from "@/types/author";
import type { MediaRef } from "@/types/media";
import type { TagRef } from "@/types/tag";
import type { MockDb } from "./db";

/*
 * Joins shared by the modules' mock api.ts files — the equivalent of the
 * backend's response mappers.
 */

export function mediaRef(db: MockDb, id: string | null): MediaRef | null {
  if (!id) return null;
  const media = db.media.find((m) => m.id === id);
  return media ? { id: media.id, url: media.url, altText: media.altText } : null;
}

export function authorRefs(db: MockDb, ids: string[]): AuthorRef[] {
  return ids.flatMap((id) => {
    const author = db.authors.find((a) => a.id === id);
    return author ? [{ id: author.id, name: author.name, avatar: mediaRef(db, author.avatarId) }] : [];
  });
}

export function tagRefs(db: MockDb, ids: string[]): TagRef[] {
  return ids.flatMap((id) => {
    const tag = db.tags.find((t) => t.id === id);
    return tag ? [{ id: tag.id, name: tag.name, slug: tag.slug }] : [];
  });
}

/** Posts (as cover or inline image) and authors (as avatar) that reference an image. */
export function mediaUsageCount(db: MockDb, mediaId: string): number {
  const inPosts = db.posts.filter(
    (post) => post.coverImageId === mediaId || collectImageIds(post.content).includes(mediaId),
  ).length;
  const inAuthors = db.authors.filter((author) => author.avatarId === mediaId).length;
  return inPosts + inAuthors;
}
