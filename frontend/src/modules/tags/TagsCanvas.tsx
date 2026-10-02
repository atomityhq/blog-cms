"use client";

import { useState } from "react";
import { EllipsisVertical, Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, pluralize } from "@/lib/format";
import { slugify } from "@/lib/slug";
import type { Tag } from "@/types/tag";
import { createTag, deleteTag, listTags, updateTag } from "./api";

export function TagsCanvas() {
  const toast = useToast();
  const tags = useAsync(listTags, []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Tag | "new" | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const needle = query.trim().toLowerCase();
  const rows = (tags.data ?? []).filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.slug.includes(needle));

  const columns: DataTableColumn<Tag>[] = [
    {
      key: "name",
      header: "Name",
      render: (tag) => (
        <StatusChip tone="neutral" className="!text-[11px] !normal-case !tracking-normal">
          {tag.name}
        </StatusChip>
      ),
    },
    { key: "slug", header: "Slug", render: (tag) => <span className="font-mono text-[11.5px] text-secondary">{tag.slug}</span> },
    {
      key: "posts",
      header: "Posts",
      width: "90px",
      align: "right",
      render: (tag) => <span className="font-mono text-[11.5px] tabular-nums">{tag.postCount}</span>,
    },
    { key: "created", header: "Added", width: "120px", render: (tag) => <span className="text-secondary">{formatDate(tag.createdAt)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "48px",
      align: "right",
      render: (tag) => (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
          <Menu
            items={[
              { label: "Rename", icon: Pencil, onSelect: () => setEditing(tag) },
              { label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(tag) },
            ]}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={`Actions for ${tag.name}`}
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

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 p-[var(--page-pad)]">
      <PageHeader
        title="Tags"
        description="Topics used to group and filter posts."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={14} aria-hidden /> New tag
          </button>
        }
      />

      <div className="rounded-lg border-[1.5px] border-line bg-card shadow-card">
        <div className="border-b border-line px-3.5 py-3">
          <div className="max-w-[320px]">
            <SearchInput label="Search tags" placeholder="Search tags" value={query} onChange={setQuery} />
          </div>
        </div>
        <div className="px-1">
          {tags.error ? (
            <div className="p-4">
              <ErrorState title="Couldn't load tags" error={tags.error} onRetry={tags.reload} />
            </div>
          ) : tags.data && rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={TagIcon}
                title={needle ? "No tags match" : "No tags yet"}
                description={needle ? "Try another search." : "Create tags here or straight from the post editor."}
              />
            </div>
          ) : (
            <DataTable
              caption="Tags"
              columns={columns}
              rows={rows}
              rowKey={(t) => t.id}
              onRowClick={setEditing}
              loading={tags.loading}
              skeletonRows={5}
            />
          )}
        </div>
      </div>

      {editing && (
        <TagDialog
          tag={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            toast.success(isNew ? `Created tag “${saved.name}”.` : "Tag updated.");
            tags.reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          message={
            deleting.postCount > 0
              ? `It will be removed from ${pluralize(deleting.postCount, "post")}. The posts themselves stay.`
              : "No posts use this tag."
          }
          confirmLabel="Delete"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await deleteTag(deleting.id);
              toast.success(`Deleted “${deleting.name}”.`);
              tags.reload();
            } catch (error) {
              toast.error((error as Error).message);
              throw error;
            }
          }}
        />
      )}
    </div>
  );
}

function TagDialog({ tag, onClose, onSaved }: { tag: Tag | null; onClose: () => void; onSaved: (tag: Tag, isNew: boolean) => void }) {
  const [name, setName] = useState(tag?.name ?? "");
  const [slug, setSlug] = useState(tag?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(tag));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(undefined);
    const input = { name, slug: slug || slugify(name) };
    try {
      const saved = tag ? await updateTag(tag.id, input) : await createTag(input);
      onSaved(saved, !tag);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={tag ? "Rename tag" : "New tag"}
      onClose={onClose}
      maxWidth={420}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving && <Spinner size={12} />}
            {tag ? "Save" : "Create tag"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="tag-name">
          <input
            id="tag-name"
            className="input"
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Slug" htmlFor="tag-slug" hint="Used in tag page URLs.">
          <input
            id="tag-slug"
            className="input font-mono !text-[12px]"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error-text">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
