"use client";

import { useState } from "react";
import { Plus, UsersRound as AudienceIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/lib/format";
import { slugify } from "@/lib/slug";
import type { Audience } from "@/types/audience";
import { createAudience, listAudiences } from "./api";

export function AudiencesCanvas() {
  const toast = useToast();
  const audiences = useAsync(listAudiences, []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Audience | "new" | null>(null);

  const needle = query.trim().toLowerCase();
  const rows = (audiences.data ?? []).filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.slug.includes(needle));

  const columns: DataTableColumn<Audience>[] = [
    {
      key: "name",
      header: "Name",
      render: (audience) => (
        <span
          title={audience.name}
          className="btn max-w-full !cursor-default bg-hover !normal-case !tracking-normal text-muted"
        >
          <span className="min-w-0 truncate">{audience.name}</span>
        </span>
      ),
    },
    { key: "slug", header: "Slug", render: (audience) => <span className="[overflow-wrap:anywhere] font-mono text-[11.5px] text-secondary">{audience.slug}</span> },
    {
      key: "posts",
      header: "Posts",
      width: "90px",
      align: "right",
      render: (audience) => <span className="font-mono text-[11.5px] tabular-nums">{audience.postCount}</span>,
    },
    { key: "created", header: "Added", width: "120px", render: (audience) => <span className="text-secondary">{formatDate(audience.createdAt)}</span> },

  ];

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 p-[var(--page-pad)]">
      <PageHeader
        title="Audiences"
        description="Groups of people your posts are written for."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            <Plus size={14} aria-hidden /> New audience
          </button>
        }
      />

      <div className="rounded-lg border-[1.5px] border-line bg-card shadow-card">
        <div className="border-b border-line px-3.5 py-3">
          <div className="max-w-[320px]">
            <SearchInput label="Search audiences" placeholder="Search audiences" value={query} onChange={setQuery} />
          </div>
        </div>
        <div className="overflow-x-auto px-1">
          {audiences.error ? (
            <div className="p-4">
              <ErrorState title="Couldn't load audiences" error={audiences.error} onRetry={audiences.reload} />
            </div>
          ) : audiences.data && rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={AudienceIcon}
                title={needle ? "No audiences match" : "No audiences yet"}
                description={needle ? "Try another search." : "Create reusable audience labels for the post editor."}
              />
            </div>
          ) : (
            <div className="min-w-[560px]">
              <DataTable
                caption="Audiences"
                columns={columns}
                rows={rows}
                rowKey={(t) => t.id}
                loading={audiences.loading}
                skeletonRows={5}
              />
            </div>
          )}
        </div>
      </div>

      {editing && (
        <AudienceDialog
          audience={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            toast.success(isNew ? `Added audience “${saved.name}”.` : `Updated audience “${saved.name}”.`);
            audiences.reload();
          }}
        />
      )}

    </div>
  );
}

function AudienceDialog({ audience, onClose, onSaved }: { audience: Audience | null; onClose: () => void; onSaved: (audience: Audience, isNew: boolean) => void }) {
  const [name, setName] = useState(audience?.name ?? "");
  const [slug, setSlug] = useState(audience?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
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
      const saved = await createAudience(input);
      onSaved(saved, !audience);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={audience ? "Rename audience" : "New audience"}
      onClose={onClose}
      maxWidth={420}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving && <Spinner size={12} />}
            {audience ? "Save" : "Create audience"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="audience-name">
          <input
            id="audience-name"
            className="input"
            value={name}
            maxLength={100}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Slug" htmlFor="audience-slug" hint="Follows the name unless you customize it.">
          <input
            id="audience-slug"
            className="input font-mono !text-[12px]"
            maxLength={120}
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
