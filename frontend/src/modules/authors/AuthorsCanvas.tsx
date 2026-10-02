"use client";

import { useState } from "react";
import { EllipsisVertical, ImagePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
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
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, pluralize } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { MediaPickerModal } from "@/modules/media/MediaPickerModal";
import type { Author } from "@/types/author";
import type { MediaRef } from "@/types/media";
import { createAuthor, deleteAuthor, listAuthors, updateAuthor } from "./api";

export function AuthorsCanvas() {
  const toast = useToast();
  const authors = useAsync(listAuthors, []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Author | "new" | null>(null);
  const [deleting, setDeleting] = useState<Author | null>(null);

  const needle = query.trim().toLowerCase();
  const rows = (authors.data ?? []).filter((a) => !needle || a.name.toLowerCase().includes(needle) || a.slug.includes(needle));

  const columns: DataTableColumn<Author>[] = [
    {
      key: "name",
      header: "Name",
      render: (author) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={author.name} image={author.avatar} size={30} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{author.name}</div>
            <div className="truncate font-mono text-[11px] text-muted">{author.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: "bio",
      header: "Bio",
      render: (author) => <span className="line-clamp-2 text-secondary">{author.bio || <span className="text-muted">—</span>}</span>,
    },
    {
      key: "posts",
      header: "Posts",
      width: "90px",
      align: "right",
      render: (author) => <span className="font-mono text-[11.5px] tabular-nums">{author.postCount}</span>,
    },
    { key: "created", header: "Added", width: "120px", render: (author) => <span className="text-secondary">{formatDate(author.createdAt)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "48px",
      align: "right",
      render: (author) => (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
          <Menu
            items={[
              { label: "Edit", icon: Pencil, onSelect: () => setEditing(author) },
              { label: "Delete", icon: Trash2, danger: true, onSelect: () => setDeleting(author) },
            ]}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                aria-label={`Actions for ${author.name}`}
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
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 p-[var(--page-pad)]">
      <PageHeader
        title="Authors"
        description="People credited on posts."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={14} aria-hidden /> New author
          </button>
        }
      />

      <div className="rounded-lg border-[1.5px] border-line bg-card shadow-card">
        <div className="border-b border-line px-3.5 py-3">
          <div className="max-w-[320px]">
            <SearchInput label="Search authors" placeholder="Search authors" value={query} onChange={setQuery} />
          </div>
        </div>
        <div className="px-1">
          {authors.error ? (
            <div className="p-4">
              <ErrorState title="Couldn't load authors" error={authors.error} onRetry={authors.reload} />
            </div>
          ) : authors.data && rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Users}
                title={needle ? "No authors match" : "No authors yet"}
                description={needle ? "Try another search." : "Add the people who write your posts."}
              />
            </div>
          ) : (
            <DataTable
              caption="Authors"
              columns={columns}
              rows={rows}
              rowKey={(a) => a.id}
              onRowClick={setEditing}
              loading={authors.loading}
              skeletonRows={4}
            />
          )}
        </div>
      </div>

      {editing && (
        <AuthorDialog
          author={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            toast.success(isNew ? `Added ${saved.name}.` : "Author updated.");
            authors.reload();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message={
            deleting.postCount > 0
              ? `They are credited on ${pluralize(deleting.postCount, "post")}. The posts stay, but will no longer list this author.`
              : "This author isn't credited on any posts."
          }
          confirmLabel="Delete"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await deleteAuthor(deleting.id);
              toast.success(`Deleted ${deleting.name}.`);
              authors.reload();
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

function AuthorDialog({
  author,
  onClose,
  onSaved,
}: {
  author: Author | null;
  onClose: () => void;
  onSaved: (author: Author, isNew: boolean) => void;
}) {
  const [name, setName] = useState(author?.name ?? "");
  const [slug, setSlug] = useState(author?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(author));
  const [bio, setBio] = useState(author?.bio ?? "");
  const [avatar, setAvatar] = useState<MediaRef | null>(author?.avatar ?? null);
  const [picking, setPicking] = useState(false);
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
    const input = { name, slug: slug || slugify(name), bio, avatarId: avatar?.id ?? null };
    try {
      const saved = author ? await updateAuthor(author.id, input) : await createAuthor(input);
      onSaved(saved, !author);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={author ? "Edit author" : "New author"}
      onClose={onClose}
      maxWidth={480}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving && <Spinner size={12} />}
            {author ? "Save" : "Add author"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={name || "?"} image={avatar} size={52} />
          <div className="flex gap-1.5">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicking(true)}>
              <ImagePlus size={12} aria-hidden /> {avatar ? "Change photo" : "Add photo"}
            </button>
            {avatar && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvatar(null)}>
                Remove
              </button>
            )}
          </div>
        </div>
        <Field label="Name" htmlFor="author-name">
          <input
            id="author-name"
            className="input"
            value={name}
            maxLength={100}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Slug" htmlFor="author-slug" hint="Used in author page URLs.">
          <input
            id="author-slug"
            className="input font-mono !text-[12px]"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
          />
        </Field>
        <Field label="Bio" htmlFor="author-bio" count={{ current: bio.length, max: 500 }}>
          <textarea id="author-bio" rows={3} className="input" value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error-text">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
      {picking && (
        <MediaPickerModal
          title="Choose a photo"
          onClose={() => setPicking(false)}
          onSelect={(media) => setAvatar({ id: media.id, url: media.url, altText: media.altText })}
        />
      )}
    </Modal>
  );
}
