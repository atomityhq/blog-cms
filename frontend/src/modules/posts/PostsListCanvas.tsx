"use client";

/* eslint-disable @next/next/no-img-element -- cover thumbnails are user uploads (data/remote URLs) */
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Copy,
  EllipsisVertical,
  FileText,
  Pencil,
  Plus,
  SearchX,
  Send,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { AvatarStack } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { PostStatusChip, StatusChip } from "@/components/ui/StatusChip";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDateTime, timeAgo } from "@/lib/format";
import { listAuthors } from "@/modules/authors/api";
import { listTags } from "@/modules/tags/api";
import {
  validSortKeys,
  validStatuses,
  type PostSortKey,
  type PostSummary,
  type StatusTab,
} from "@/types/post";
import {
  archivePost,
  countPostsByStatus,
  deletePost,
  duplicatePost,
  listPosts,
  publishPost,
  unpublishPost,
} from "./api";

const PAGE_SIZE = 10;

export function PostsListCanvas() {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultOptions = {
    status: "ALL",
    authorId: "",
    tagId: "",
    sort: { key: "createdAt", direction: "desc" },
    direction: "desc",
    page: 0,
  };

  const rawStatus = searchParams.get("status");

  const status: StatusTab =
    rawStatus === "ALL" || validStatuses.some((value) => value === rawStatus)
      ? (rawStatus as StatusTab)
      : "ALL";
  const authorId = searchParams.get("authors") ?? "";
  const tagId = searchParams.get("tags") ?? "";

  const rawSort = searchParams.get("sort");

  const sortKey: PostSortKey =
    rawSort && validSortKeys.some((key) => key === rawSort)
      ? (rawSort as PostSortKey)
      : "updatedAt";

  const sortDirection =
    searchParams.get("direction") === "asc" ? "asc" : "desc";

  const sort: DataTableSort = {
    key: sortKey,
    direction: sortDirection,
  };

  const query = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page") ?? defaultOptions.page);

  const [pendingDelete, setPendingDelete] = useState<PostSummary | null>(null);
  const debouncedQuery = useDebouncedValue(query);

  const posts = useAsync(
    () =>
      listPosts({
        status: status === "ALL" ? undefined : status,
        q: debouncedQuery,
        tagId: tagId || undefined,
        authorId: authorId || undefined,
        sort: sortKey,
        direction: sortDirection,
        page,
        size: PAGE_SIZE,
      }),
    [status, debouncedQuery, tagId, authorId, sortKey, sortDirection, page],
  );
  const counts = useAsync(countPostsByStatus, []);
  const authors = useAsync(listAuthors, []);
  const tags = useAsync(listTags, []);

  const hasFilters = Boolean(query || tagId || authorId);
  // handdel Applay all filters
  const resetPage = (filterKey: string, value: string | number) => {
    updateParams({
      [filterKey]: String(value),
      page: null,
    });
  };

  // reeset All Table Filters
  const resetAllFilters = (): void => {
    updateParams({
      status: null,
      authors: null,
      tags: null,
      search: null,
      page: null,
    });
  };

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const refresh = () => {
    posts.reload();
    counts.reload();
  };

  /** Runs a row action, then refreshes the list and reports the outcome. */
  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
      throw error;
    }
  };

  const rowActions = (post: PostSummary): (MenuItem | "separator")[] => [
    {
      label: "Edit",
      icon: Pencil,
      onSelect: () => router.push(`/posts/${post.id}`),
    },
    {
      label: "Duplicate",
      icon: Copy,
      onSelect: () =>
        void run(
          () => duplicatePost(post.id),
          `Created a copy of “${post.title || "Untitled"}”.`,
        ).catch(() => {}),
    },
    "separator",
    post.status === "PUBLISHED"
      ? {
          label: "Unpublish",
          icon: Undo2,
          onSelect: () =>
            void run(
              () => unpublishPost(post.id),
              "Moved back to drafts.",
            ).catch(() => {}),
        }
      : {
          label: "Publish",
          icon: Send,
          onSelect: () =>
            void run(() => publishPost(post.id), "Post published.").catch(
              () => {},
            ),
        },
    post.status === "ARCHIVED"
      ? {
          label: "Restore to drafts",
          icon: Undo2,
          onSelect: () =>
            void run(() => unpublishPost(post.id), "Restored to drafts.").catch(
              () => {},
            ),
        }
      : {
          label: "Archive",
          icon: Archive,
          onSelect: () =>
            void run(() => archivePost(post.id), "Post archived.").catch(
              () => {},
            ),
        },
    "separator",
    {
      label: "Delete",
      icon: Trash2,
      danger: true,
      onSelect: () => setPendingDelete(post),
    },
  ];

  const columns: DataTableColumn<PostSummary>[] = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (post) => (
        <div className="flex min-w-0 items-center gap-3">
          {post.coverImage ? (
            <img
              src={post.coverImage.url}
              alt=""
              className="h-9 w-14 shrink-0 rounded-sm border border-line object-cover"
            />
          ) : (
            <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-sm border border-dashed border-line text-[var(--atomity-gray-400)]">
              <FileText size={14} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={
                  post.title
                    ? "truncate font-semibold"
                    : "truncate font-semibold text-muted italic"
                }
              >
                {post.title || "Untitled"}
              </span>
              {post.featured && (
                <Star
                  size={12}
                  className="shrink-0 fill-[var(--atomity-orange)] text-[var(--atomity-orange)]"
                  aria-label="Featured"
                />
              )}
            </div>
            <div className="truncate font-mono text-[11px] text-muted">
              /{post.slug}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "112px",
      render: (post) => <PostStatusChip status={post.status} />,
    },
    {
      key: "authors",
      header: "Authors",
      width: "104px",
      render: (post) => <AvatarStack people={post.authors} />,
    },
    {
      key: "tags",
      header: "Tags",
      width: "200px",
      render: (post) =>
        post.tags.length === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 2).map((tag) => (
              <StatusChip
                key={tag.id}
                tone="neutral"
                className="!normal-case !tracking-normal"
              >
                {tag.name}
              </StatusChip>
            ))}
            {post.tags.length > 2 && (
              <span className="font-mono text-[10px] text-muted">
                +{post.tags.length - 2}
              </span>
            )}
          </div>
        ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      width: "116px",
      sortable: true,
      render: (post) => (
        <span title={formatDateTime(post.updatedAt)} className="text-secondary">
          {timeAgo(post.updatedAt)}
        </span>
      ),
    },
    {
      key: "wordCount",
      header: "Words",
      width: "80px",
      align: "right",
      sortable: true,
      render: (post) => (
        <span className="font-mono text-[11.5px] tabular-nums">
          {post.wordCount.toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "48px",
      align: "right",
      render: (post) => (
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="inline-flex"
        >
          <Menu
            items={rowActions(post)}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={`Actions for ${post.title || "Untitled"}`}
                className="cursor-pointer rounded-sm p-1 text-muted hover:bg-hover hover:text-ink"
              >
                <EllipsisVertical size={15} />
              </button>
            )}
          />
        </div>
      ),
    },
  ];

  const onSortChange = (key: string) => {
    const nextDirection =
      sort.key === key && sort.direction === "desc"
        ? "asc"
        : key === "title"
          ? "asc"
          : "desc";

    updateParams({
      sort: key,
      direction: nextDirection,
      page: null,
    });
  };

  const rows = posts.data?.items ?? [];
  const isFirstLoad = posts.loading && !posts.data;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 p-[var(--page-pad)]">
      <PageHeader
        title="Posts"
        description="Write, review and publish your blog posts."
        actions={
          <Link href="/posts/new" className="btn btn-primary">
            <Plus size={14} aria-hidden />
            New post
          </Link>
        }
      />

      <div className="rounded-lg border-[1.5px] border-line bg-card shadow-card">
        <div className="px-3.5 pt-1">
          <Tabs<StatusTab>
            label="Filter by status"
            value={status}
            onChange={(value) => resetPage("status", value)}
            items={[
              { key: "ALL", label: "All", count: counts.data?.ALL },
              { key: "DRAFT", label: "Drafts", count: counts.data?.DRAFT },
              {
                key: "PUBLISHED",
                label: "Published",
                count: counts.data?.PUBLISHED,
              },
              {
                key: "ARCHIVED",
                label: "Archived",
                count: counts.data?.ARCHIVED,
              },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-3">
          <div className="min-w-[220px] flex-1">
            <SearchInput
              label="Search posts"
              placeholder="Search title, slug or content"
              value={query}
              onChange={(value) => resetPage("search", value)}
            />
          </div>
          <Select
            aria-label="Filter by author"
            value={authorId}
            onChange={(e) => resetPage("authors", e.target.value)}
            className="w-[170px]"
            options={[
              { value: "", label: "All authors" },
              ...(authors.data ?? []).map((a) => ({
                value: a.id,
                label: a.name,
              })),
            ]}
          />
          <Select
            aria-label="Filter by tag"
            value={tagId}
            onChange={(e) => resetPage("tags", e.target.value)}
            className="w-[160px]"
            options={[
              { value: "", label: "All tags" },
              ...(tags.data ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          {hasFilters && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetAllFilters}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="px-1">
          {posts.error ? (
            <div className="p-4">
              <ErrorState
                title="Couldn't load posts"
                error={posts.error}
                onRetry={posts.reload}
              />
            </div>
          ) : !isFirstLoad && rows.length === 0 ? (
            <div className="p-4">
              {hasFilters || status !== "ALL" ? (
                <EmptyState
                  icon={SearchX}
                  title="No posts match"
                  description="Try a different search, status or filter."
                />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No posts yet"
                  description="Your first post is one click away."
                  action={
                    <Link href="/posts/new" className="btn btn-primary btn-sm">
                      <Plus size={13} aria-hidden /> New post
                    </Link>
                  }
                />
              )}
            </div>
          ) : (
            <DataTable
              caption="Posts"
              columns={columns}
              rows={rows}
              rowKey={(post) => post.id}
              onRowClick={(post) => router.push(`/posts/${post.id}`)}
              sort={sort}
              onSortChange={onSortChange}
              loading={posts.loading}
            />
          )}
        </div>

        {posts.data && posts.data.meta.totalElements > 0 && (
          <div className="border-t border-line px-3.5 py-2">
            <Pagination
              meta={posts.data.meta}
              onPageChange={(value) =>
                updateParams({
                  page: String(value),
                })
              }
              noun="posts"
            />
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this post?"
          message={
            <>
              <strong>{pendingDelete.title || "Untitled"}</strong> will be
              permanently deleted. This can’t be undone — archive it instead if
              you might need it again.
            </>
          }
          confirmLabel="Delete"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() =>
            run(() => deletePost(pendingDelete.id), "Post deleted.")
          }
        />
      )}
    </div>
  );
}
