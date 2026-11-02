import type { DataTableSort } from "@/components/ui/DataTable";
import { POST_STATUSES, type PostSortKey, type PostStatus } from "@/types/post";

/*
 * The posts list keeps its tab, search, filters, sort and page in the URL, so they
 * survive opening a post and coming back, a reload, or a shared link. The URL only
 * holds values that differ from the defaults, and anything it can't use is ignored.
 */

export type StatusTab = PostStatus | "ALL";

export interface PostsListState {
  tab: StatusTab;
  query: string;
  tagId: string;
  authorId: string;
  sort: DataTableSort;
  /** Zero-based, like the API. The URL shows it one-based. */
  page: number;
}

const SORT_KEYS: PostSortKey[] = ["updatedAt", "title", "publishedAt", "wordCount"];

export const DEFAULT_LIST_STATE: PostsListState = {
  tab: "ALL",
  query: "",
  tagId: "",
  authorId: "",
  sort: { key: "updatedAt", direction: "desc" },
  page: 0,
};

/** Reads the list state from a query string, falling back to the defaults. */
export function readListState(params: Pick<URLSearchParams, "get">): PostsListState {
  const status = params.get("status");
  const sort = params.get("sort");
  const direction = params.get("direction");
  const page = Number(params.get("page"));
  return {
    tab: POST_STATUSES.includes(status as PostStatus) ? (status as PostStatus) : DEFAULT_LIST_STATE.tab,
    query: params.get("q") ?? "",
    tagId: params.get("tag") ?? "",
    authorId: params.get("author") ?? "",
    sort: {
      key: SORT_KEYS.includes(sort as PostSortKey) ? (sort as PostSortKey) : DEFAULT_LIST_STATE.sort.key,
      direction: direction === "asc" || direction === "desc" ? direction : DEFAULT_LIST_STATE.sort.direction,
    },
    page: Number.isInteger(page) && page > 1 ? page - 1 : 0,
  };
}

/** The query string for a list state ("" when everything is at its default). */
export function listStateToSearch(state: PostsListState): string {
  const params = new URLSearchParams();
  if (state.tab !== DEFAULT_LIST_STATE.tab) params.set("status", state.tab);
  if (state.query) params.set("q", state.query);
  if (state.tagId) params.set("tag", state.tagId);
  if (state.authorId) params.set("author", state.authorId);
  if (state.sort.key !== DEFAULT_LIST_STATE.sort.key || state.sort.direction !== DEFAULT_LIST_STATE.sort.direction) {
    params.set("sort", state.sort.key);
    params.set("direction", state.sort.direction);
  }
  if (state.page > 0) params.set("page", String(state.page + 1));
  const text = params.toString();
  return text ? `?${text}` : "";
}
