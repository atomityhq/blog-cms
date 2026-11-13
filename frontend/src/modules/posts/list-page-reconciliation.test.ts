import { describe, expect, it } from "vitest";
import type { Page, PageMeta } from "@/types/api";
import type { PostListParams } from "@/types/post";
import {
  buildPostListParams,
  postListQueryKey,
  postsListView,
  reconcilePostListPage,
  type PostsListViewInput,
} from "./list-page-reconciliation";

function meta(page: number, totalPages: number): PageMeta {
  return { page, size: 10, totalElements: totalPages === 0 ? 0 : (totalPages - 1) * 10 + 1, totalPages };
}

describe("reconcilePostListPage", () => {
  it("builds list params with search and author filters for the active query", () => {
    expect(
      buildPostListParams({
        tab: "ALL",
        query: "release notes",
        tagId: "",
        authorId: "author-1",
        sort: "updatedAt",
        direction: "asc",
        page: 1,
        pageSize: 10,
      }),
    ).toEqual({
      q: "release notes",
      authorId: "author-1",
      sort: "updatedAt",
      direction: "asc",
      page: 1,
      size: 10,
      status: undefined,
      tagId: undefined,
    });
  });

  it("moves an out-of-range last page back while preserving the active query", () => {
    const params: PostListParams = {
      status: "PUBLISHED",
      q: "release notes",
      tagId: "tag-1",
      authorId: "author-1",
      sort: "updatedAt",
      direction: "asc",
      page: 1,
      size: 10,
    };

    expect(reconcilePostListPage(params, meta(1, 1))).toEqual({ ...params, page: 0 });
  });

  it.each([
    {
      name: "search",
      params: { q: "release notes", page: 2, size: 10 } satisfies PostListParams,
      response: meta(2, 2),
    },
    {
      name: "author filter",
      params: { authorId: "author-1", page: 1, size: 10 } satisfies PostListParams,
      response: meta(1, 1),
    },
    {
      name: "search and author filter",
      params: { q: "release", authorId: "author-1", page: 3, size: 10 } satisfies PostListParams,
      response: meta(3, 2),
    },
  ])("preserves the $name query while correcting its page", ({ params, response }) => {
    const corrected = reconcilePostListPage(params, response);
    expect(corrected).toEqual({ ...params, page: response.totalPages - 1 });
    expect(corrected?.q).toBe(params.q);
    expect(corrected?.authorId).toBe(params.authorId);
  });

  it("keeps the page when it remains valid", () => {
    const params: PostListParams = { page: 1, size: 10 };
    expect(reconcilePostListPage(params, meta(1, 2))).toBeNull();
  });

  it("ignores a stale response for a different requested page", () => {
    const params: PostListParams = { page: 1, size: 10 };
    expect(reconcilePostListPage(params, meta(0, 1))).toBeNull();
  });

  it("returns to page 1 when an out-of-range query now has no results", () => {
    const params: PostListParams = { q: "no match", authorId: "author-1", page: 2, size: 10 };
    expect(reconcilePostListPage(params, meta(2, 0))).toEqual({ ...params, page: 0 });
  });

  it("does not move page 1 for a genuinely empty result", () => {
    const params: PostListParams = { page: 0, size: 10 };
    expect(reconcilePostListPage(params, meta(0, 0))).toBeNull();
  });

  it("does not correct malformed page metadata", () => {
    const params: PostListParams = { page: 2, size: 10 };
    expect(reconcilePostListPage(params, { ...meta(2, 2), totalPages: -1 })).toBeNull();
  });
});

describe("postListQueryKey", () => {
  const params: PostListParams = {
    status: "DRAFT",
    q: "release",
    tagId: "tag-1",
    authorId: "author-1",
    sort: "title",
    direction: "asc",
    page: 2,
    size: 10,
  };

  it("is the same for every page of one query", () => {
    expect(postListQueryKey({ ...params, page: 0 })).toBe(postListQueryKey(params));
  });

  it.each([
    { name: "status", change: { status: "PUBLISHED" } },
    { name: "search", change: { q: "notes" } },
    { name: "tag", change: { tagId: "tag-2" } },
    { name: "author", change: { authorId: "author-2" } },
    { name: "sort", change: { sort: "updatedAt" } },
    { name: "direction", change: { direction: "desc" } },
  ] satisfies { name: string; change: Partial<PostListParams> }[])("changes when the $name changes", ({ change }) => {
    expect(postListQueryKey({ ...params, ...change })).not.toBe(postListQueryKey(params));
  });
});

describe("postsListView", () => {
  type Row = { id: string };

  function rows(count: number, from = 0): Row[] {
    return Array.from({ length: count }, (_, i) => ({ id: `post-${from + i}` }));
  }

  function page(items: Row[], pageIndex: number, totalElements: number): Page<Row> {
    return { items, meta: { page: pageIndex, size: 10, totalElements, totalPages: Math.ceil(totalElements / 10) } };
  }

  function view(input: Partial<PostsListViewInput<Row>> & Pick<PostsListViewInput<Row>, "params">) {
    return postsListView<Row>({ data: undefined, error: undefined, loading: false, correctionQueryKey: null, ...input });
  }

  describe("normal pagination", () => {
    it("shows a loading table without an empty state or pagination on first load", () => {
      expect(view({ loading: true, params: { page: 0, size: 10 } })).toEqual({
        rows: [],
        pageCorrectionPending: false,
        tableLoading: true,
        showEmptyState: false,
        showPagination: false,
      });
    });

    it("keeps the current rows and pagination visible while the next page loads", () => {
      const current = page(rows(10), 0, 25);
      expect(view({ data: current, loading: true, params: { page: 1, size: 10 } })).toEqual({
        rows: current.items,
        pageCorrectionPending: false,
        tableLoading: true,
        showEmptyState: false,
        showPagination: true,
      });
    });

    it("keeps the current rows visible while a row action refreshes the same page", () => {
      const current = page(rows(5, 10), 1, 15);
      const result = view({ data: current, loading: true, params: { page: 1, size: 10 } });
      expect(result.rows).toBe(current.items);
      expect(result.showEmptyState).toBe(false);
    });

    it("shows the rows of a settled valid page", () => {
      const settled = page(rows(10, 10), 1, 25);
      expect(view({ data: settled, params: { page: 1, size: 10 } })).toEqual({
        rows: settled.items,
        pageCorrectionPending: false,
        tableLoading: false,
        showEmptyState: false,
        showPagination: true,
      });
    });

    it("shows the empty state for a genuinely empty first page", () => {
      const result = view({ data: page([], 0, 0), params: { page: 0, size: 10 } });
      expect(result.showEmptyState).toBe(true);
      expect(result.showPagination).toBe(false);
      expect(result.pageCorrectionPending).toBe(false);
    });
  });

  describe("invalid-page correction", () => {
    const outOfRange: PostListParams = { page: 1, size: 10 };
    const corrected: PostListParams = { page: 0, size: 10 };

    it("hides the empty state and pagination when a settled page no longer exists", () => {
      expect(view({ data: page([], 1, 10), params: outOfRange })).toEqual({
        rows: [],
        pageCorrectionPending: true,
        tableLoading: true,
        showEmptyState: false,
        showPagination: false,
      }); // Page 2 comes back empty, if its only post is deleted
    });

    it("stays in the correcting state while the corrected page loads", () => {
      const result = view({
        data: page([], 1, 10),
        loading: true,
        params: corrected,
        correctionQueryKey: postListQueryKey(corrected),
      });
      expect(result).toMatchObject({ rows: [], showEmptyState: false, showPagination: false, tableLoading: true });
    });

    it("shows the corrected page once its response arrives", () => {
      const settled = page(rows(10), 0, 10);
      expect(view({ data: settled, params: corrected })).toEqual({
        rows: settled.items,
        pageCorrectionPending: false,
        tableLoading: false,
        showEmptyState: false,
        showPagination: true,
      });
    });

    it("stops correcting when the request fails", () => {
      const result = view({
        data: page([], 1, 10),
        error: new Error("Network error"),
        params: corrected,
        correctionQueryKey: postListQueryKey(corrected),
      });
      expect(result.pageCorrectionPending).toBe(false);
      expect(result.showEmptyState).toBe(false);
    });
  });

  describe("filter-based reconciliation", () => {
    const filtered: PostListParams = { status: "DRAFT", q: "release", authorId: "author-1", tagId: "tag-1", page: 2, size: 10 };

    it("corrects a filtered page without losing its filters", () => {
      const response = page([], 2, 12);
      expect(view({ data: response, params: filtered }).pageCorrectionPending).toBe(true);
      const next = reconcilePostListPage(filtered, response.meta);
      expect(next).toEqual({ ...filtered, page: 1 });
      expect(postListQueryKey(next!)).toBe(postListQueryKey(filtered));
    });

    it("keeps a correction tied to the filters it was made for", () => {
      const next = { ...filtered, page: 1 };
      const loadingCorrected = { data: page([], 2, 12), loading: true, correctionQueryKey: postListQueryKey(next) };
      expect(view({ ...loadingCorrected, params: next }).pageCorrectionPending).toBe(true);
      expect(view({ ...loadingCorrected, params: { ...next, authorId: "author-2", page: 0 } }).pageCorrectionPending).toBe(false);
    });

    it("shows the no-match empty state when a filtered query loses all its results", () => {
      const response = page([], 2, 0);
      expect(view({ data: response, params: filtered }).showEmptyState).toBe(false);

      const firstPage = { ...filtered, page: 0 };
      expect(reconcilePostListPage(filtered, response.meta)).toEqual(firstPage);
      expect(view({ data: page([], 0, 0), params: firstPage })).toMatchObject({
        rows: [],
        pageCorrectionPending: false,
        showEmptyState: true,
        showPagination: false,
      });
    });
  });
});
