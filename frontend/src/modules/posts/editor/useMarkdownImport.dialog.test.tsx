// @vitest-environment jsdom
import { act, createElement, useEffect, useState, type ChangeEvent, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkdownImport } from "./useMarkdownImport";
import { replaceMarkdownSource, deleteSourceIfPresent } from "./markdownSourceLifecycle";

const { success, error } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ success, error }) }));
vi.mock("./markdownSourceLifecycle", () => ({ replaceMarkdownSource: vi.fn(), deleteSourceIfPresent: vi.fn() }));
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Existing" }] }] };
const source = { id: "replacement", fileName: "next.md", sizeBytes: 6, url: "/next" };
let root: Root;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(replaceMarkdownSource).mockResolvedValue(source);
  vi.mocked(deleteSourceIfPresent).mockResolvedValue(undefined);
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function button(label: string) {
  const result = [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === label);
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

describe("replacement confirmation during keyboard Save", () => {
  it.each(["ctrlKey", "metaKey"] as const)("retains the dialog and pending file after %s+S, then permits retry", async modifier => {
    const change = vi.fn();
    const setContent = vi.fn();
    const chain = { focus: () => chain, setContent, run: () => true };
    setContent.mockReturnValue(chain);
    const editor = { isDestroyed: false, getJSON: () => doc, markdown: { parse: () => doc }, chain: () => chain };
    let choose!: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    let finishSave!: () => void;
    function Harness() {
      const [saving, setSaving] = useState(false);
      finishSave = () => setSaving(false);
      useEffect(() => {
        const save = (event: KeyboardEvent) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "s") {
            event.preventDefault();
            setSaving(true);
          }
        };
        window.addEventListener("keydown", save);
        return () => window.removeEventListener("keydown", save);
      }, []);
      const hook = useMarkdownImport(editor as unknown as Editor, change, () => {}, null, null, saving);
      choose = (hook.ui.props.children[0] as ReactElement<{ onChange: typeof choose }>).props.onChange;
      return hook.ui;
    }
    await act(async () => root.render(createElement(Harness)));
    const file = new File(["# Next"], "next.md", { type: "text/markdown" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("# Next").buffer });
    await act(async () => choose({ target: { files: [file], value: "file" } } as unknown as ChangeEvent<HTMLInputElement>));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", [modifier]: true, cancelable: true }));
    });
    await act(async () => button("Replace content").click());
    expect(error).toHaveBeenCalledExactlyOnceWith("Wait for the post to finish saving, then confirm the import again.");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(replaceMarkdownSource).not.toHaveBeenCalled();
    expect(change).not.toHaveBeenCalled();
    expect(setContent).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    await act(async () => finishSave());
    await act(async () => button("Replace content").click());
    expect(replaceMarkdownSource).toHaveBeenCalledExactlyOnceWith(file, null, null);
    expect(change).toHaveBeenCalledExactlyOnceWith(source);
    expect(setContent).toHaveBeenCalledExactlyOnceWith(doc);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
