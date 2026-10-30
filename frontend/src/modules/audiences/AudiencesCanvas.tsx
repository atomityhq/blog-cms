"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { slugify } from "@/lib/slug";
import type { Audience } from "@/types/audience";
import { createAudience } from "./api";

export function AudiencesCanvas() {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 p-[var(--page-pad)]">
      <PageHeader title="Audiences" description="Groups of people your posts are written for."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={14} aria-hidden /> New audience</button>} />
      {creating && <AudienceDialog audience={null} onClose={() => setCreating(false)}
        onSaved={(saved) => toast.success(`Added audience “${saved.name}”.`)} />}
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
