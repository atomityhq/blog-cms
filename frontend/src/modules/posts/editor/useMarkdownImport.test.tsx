import { createElement, type ChangeEvent, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Editor } from "@tiptap/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkdownImport } from "./useMarkdownImport";
import { deleteSourceIfPresent, replaceMarkdownSource } from "./markdownSourceLifecycle";

const { success, error } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ success, error }) }));
vi.mock("./markdownSourceLifecycle", () => ({ replaceMarkdownSource: vi.fn(), deleteSourceIfPresent: vi.fn() }));
const source = { id: "new", fileName: "new.md", sizeBytes: 6, url: "/new" };
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New" }] }] };

function harness(disabled = false) {
  const change = vi.fn();
  const busy = vi.fn();
  const chain = { focus: vi.fn(), setContent: vi.fn(), run: vi.fn().mockReturnValue(true) };
  chain.focus.mockReturnValue(chain);
  chain.setContent.mockReturnValue(chain);
  const editor = { isDestroyed: false, getJSON: () => ({ type: "doc", content: [] }),
    markdown: { parse: vi.fn().mockReturnValue(doc) }, chain: () => chain };
  let fileChange!: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  function Harness() {
    const hook = useMarkdownImport(editor as unknown as Editor, change, busy, null, null, disabled);
    const input = hook.ui.props.children[0] as ReactElement<{ onChange: typeof fileChange }>;
    fileChange = input.props.onChange;
    return hook.ui;
  }
  renderToStaticMarkup(createElement(Harness));
  const select = (file: File) => fileChange({ target: { files: [file], value: "file" } } as unknown as ChangeEvent<HTMLInputElement>);
  return { select, editor, chain, change, busy };
}

describe("Markdown import lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(replaceMarkdownSource).mockResolvedValue(source);
    vi.mocked(deleteSourceIfPresent).mockResolvedValue(undefined);
  });

  it("does not import while a post save is in progress", async () => {
    const h = harness(true);
    await h.select(new File(["# New"], "new.md"));
    expect(replaceMarkdownSource).not.toHaveBeenCalled();
    expect(h.busy).not.toHaveBeenCalled();
  });

  it("blocks navigation/save while the file is being read as well as uploaded", async () => {
    const h = harness();
    const file = new File(["# New"], "new.md");
    let finish!: (buffer: ArrayBuffer) => void;
    vi.spyOn(file, "arrayBuffer").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const selection = h.select(file);
    expect(h.busy).toHaveBeenCalledWith(true);
    expect(replaceMarkdownSource).not.toHaveBeenCalled();
    finish(new TextEncoder().encode("# New").buffer);
    await selection;
    expect(h.change).toHaveBeenCalledWith(source);
    expect(h.busy).toHaveBeenLastCalledWith(false);
    expect(success).toHaveBeenCalledTimes(1);
  });

  it("cleans an upload that finishes after the editor is destroyed", async () => {
    const h = harness();
    let finish!: (value: typeof source) => void;
    vi.mocked(replaceMarkdownSource).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const selection = h.select(new File(["# New"], "new.md"));
    await vi.waitFor(() => expect(replaceMarkdownSource).toHaveBeenCalled());
    h.editor.isDestroyed = true;
    finish(source);
    await selection;
    expect(deleteSourceIfPresent).toHaveBeenCalledWith(source.id);
    expect(h.change).not.toHaveBeenCalled();
    expect(h.chain.setContent).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("reports one error and leaves the editor unchanged after upload failure", async () => {
    const h = harness();
    vi.mocked(replaceMarkdownSource).mockRejectedValue(new Error("Upload failed"));
    await h.select(new File(["# New"], "new.md"));
    expect(error).toHaveBeenCalledExactlyOnceWith("Upload failed");
    expect(h.change).not.toHaveBeenCalled();
    expect(h.chain.setContent).not.toHaveBeenCalled();
    expect(h.busy).toHaveBeenLastCalledWith(false);
  });
});
