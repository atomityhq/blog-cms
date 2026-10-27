import { ApiError } from "@/types/api";
import type { MarkdownSourceRef } from "@/types/markdown";
import { deleteMarkdownSource, uploadMarkdownSource } from "../api";

/** Missing already means removed, including a retry after a lost success response. */
export async function deleteSourceIfPresent(id: string): Promise<void> {
  try {
    await deleteMarkdownSource(id);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}

/** Keep the current attachment if uploading its replacement fails. */
export async function replaceMarkdownSource(
  file: File,
  previous: MarkdownSourceRef | null,
  savedId: string | null,
): Promise<MarkdownSourceRef> {
  const next = await uploadMarkdownSource(file);
  if (isUnsavedUpload(previous, savedId)) {
    try {
      await deleteSourceIfPresent(previous.id);
    } catch (failure) {
      // Don't leave the newly uploaded replacement orphaned when old-file cleanup fails.
      try {
        await deleteSourceIfPresent(next.id);
      } catch (cleanupFailure) {
        throw new AggregateError([failure, cleanupFailure], "Couldn't replace the Markdown file or clean up its upload. Try again.");
      }
      throw failure;
    }
  }
  return next;
}

/**
 * Whether `source` is an upload this session that was never saved on the post, so it's
 * ours to delete immediately. A source that matches the post's saved attachment is left
 * for `deleteIfUnused` to clean up once the change (replacement or removal) is saved.
 */
export function isUnsavedUpload(
  source: MarkdownSourceRef | null,
  savedSourceId: string | null,
): source is MarkdownSourceRef {
  return source !== null && source.id !== savedSourceId;
}
