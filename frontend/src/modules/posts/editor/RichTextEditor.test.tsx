import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "./RichTextEditor";
import { deleteMarkdownSource } from "../api";

const { callbacks, toastError } = vi.hoisted(() => ({
  callbacks: { remove: undefined as (() => void) | undefined },
  toastError: vi.fn(),
}));

vi.mock("../api", () => ({ deleteMarkdownSource: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ error: toastError }) }));
vi.mock("@tiptap/react", () => ({ useEditor: () => null, EditorContent: () => null }));
vi.mock("./useMarkdownImport", () => ({
  useMarkdownImport: () => ({ uploading: false, openFilePicker: vi.fn(), ui: null }),
}));
vi.mock("./MarkdownSourceBar", () => ({
  MarkdownSourceBar: (props: { onRemove: () => void }) => {
    callbacks.remove = props.onRemove;
    return null;
  },
}));

const source = { id: "source-1", fileName: "post.md", sizeBytes: 6, url: "/api/v1/markdown-sources/source-1/file" };

function render(savedMarkdownSourceId: string | null) {
  const onMarkdownSourceChange = vi.fn();
  const onImportingChange = vi.fn();
  renderToStaticMarkup(createElement(RichTextEditor, {
    value: { type: "doc", content: [] },
    onChange: vi.fn(),
    markdownSource: source,
    savedMarkdownSourceId,
    onMarkdownSourceChange,
    onImportingChange,
  }));
  return { onMarkdownSourceChange, onImportingChange };
}

describe("removing a Markdown attachment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an unsaved upload before clearing its filename", async () => {
    vi.mocked(deleteMarkdownSource).mockResolvedValue(undefined);
    const { onMarkdownSourceChange, onImportingChange } = render(null);
    callbacks.remove!();
    await vi.waitFor(() => expect(onMarkdownSourceChange).toHaveBeenCalledWith(null));
    expect(deleteMarkdownSource).toHaveBeenCalledWith(source.id);
    expect(onImportingChange.mock.calls).toEqual([[true], [false]]);
  });

  it("keeps a saved source until the post is saved without it", () => {
    const { onMarkdownSourceChange } = render(source.id);
    callbacks.remove!();
    expect(deleteMarkdownSource).not.toHaveBeenCalled();
    expect(onMarkdownSourceChange).toHaveBeenCalledWith(null);
  });

  it("keeps the attachment available for retry when deletion fails", async () => {
    vi.mocked(deleteMarkdownSource).mockRejectedValue(new Error("Storage unavailable"));
    const { onMarkdownSourceChange, onImportingChange } = render(null);
    callbacks.remove!();
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("Storage unavailable"));
    expect(onMarkdownSourceChange).not.toHaveBeenCalled();
    expect(onImportingChange.mock.calls).toEqual([[true], [false]]);
  });
});
