import type { Page, PageMeta } from "@/types/api";
import type { PostListParams, PostSortKey, PostStatus } from "@/types/post";

export interface PostsListQueryInput {
  tab: PostStatus | "ALL";
  query: string;
  tagId: string;
  authorId: string;
  sort: PostSortKey;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

/** Build the exact API query for the currently visible posts list. */
export function buildPostListParams(input: PostsListQueryInput): PostListParams {
  return {
    status: input.tab === "ALL" ? undefined : input.tab,
    q: input.query,
    tagId: input.tagId || undefined,
    authorId: input.authorId || undefined,
    sort: input.sort,
    direction: input.direction,
    page: input.page,
    size: input.pageSize,
  };
}

/**
 * Return the same active list query with its page corrected when a matching
 * response proves that the requested page no longer exists.
 *
 * A response for a different page is stale for this decision and must be ignored.
 * Page zero remains the canonical empty-list page when there are no results.
 */
export function reconcilePostListPage(params: PostListParams, meta: PageMeta): PostListParams | null {
  const requestedPage = params.page ?? 0;
  if (!Number.isInteger(requestedPage) || requestedPage < 0 || meta.page !== requestedPage) return null;
  if (!Number.isInteger(meta.totalPages) || meta.totalPages < 0) return null;

  const correctedPage =
    meta.totalPages === 0
      ? requestedPage > 0
        ? 0
        : null
      : requestedPage >= meta.totalPages
        ? meta.totalPages - 1
        : null;

  if (correctedPage === null || correctedPage === requestedPage) return null;
  return { ...params, page: correctedPage };
}

/**
 * Identifies the active list query regardless of its page.
 * Page correction can be tied to the tab, filters and sort it was made for.
 */
export function postListQueryKey(params: PostListParams): string {
  return JSON.stringify({ ...params, page: undefined });
}

export interface PostsListViewInput<T> {
  data: Page<T> | undefined;
  error: Error | undefined;
  loading: boolean;
  params: PostListParams;
  correctionQueryKey: string | null; // Query key of a page correction
}

export interface PostsListView<T> {
  rows: T[];
  pageCorrectionPending: boolean; // The requested page no longer exists and the list is moving to a valid one
  tableLoading: boolean;
  showEmptyState: boolean;
  showPagination: boolean;
}

/**
 * What the posts list shows for the current request state. During an ordinary
 * request the previous rows and pagination stay visible; while an out-of-range page
 * is being corrected, neither an empty state nor an invalid range is shown.
 */
export function postsListView<T>({ data, error, loading, params, correctionQueryKey }: PostsListViewInput<T>): PostsListView<T> {
  const corrected = !loading && !error && data ? reconcilePostListPage(params, data.meta) : null;
  const pageCorrectionPending = !error && (correctionQueryKey === postListQueryKey(params) || corrected !== null);
  const rows = pageCorrectionPending ? [] : data?.items ?? [];
  return {
    rows,
    pageCorrectionPending,
    tableLoading: loading || pageCorrectionPending,
    showEmptyState: !error && !loading && !pageCorrectionPending && rows.length === 0,
    showPagination: Boolean(data && data.meta.totalElements > 0) && !pageCorrectionPending,
  };
}
