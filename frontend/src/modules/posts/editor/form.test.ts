import { describe, expect, it } from "vitest";
import type { ContentDoc } from "@/types/content";
import { EMPTY_FORM, mergeSavedForm, type EditorForm } from "./form";

function doc(text: string): ContentDoc {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

const sent: EditorForm = { ...EMPTY_FORM, title: "Hello", slug: "hello", content: doc("First draft") };

describe("mergeSavedForm", () => {
  it("returns the form unchanged when nothing changed during the save", () => {
    expect(mergeSavedForm(sent, sent, "hello")).toBe(sent);
  });

  it("keeps body text typed while the save was in flight", () => {
    const current = { ...sent, content: doc("First draft, and more") };
    expect(mergeSavedForm(current, sent, "hello").content).toEqual(doc("First draft, and more"));
  });

  it("keeps a title typed while the save was in flight", () => {
    const current = { ...sent, title: "Hello world" };
    expect(mergeSavedForm(current, sent, "hello").title).toBe("Hello world");
  });

  it("takes the slug the server filled in", () => {
    const blank = { ...sent, slug: "" };
    const current = { ...blank, content: doc("Typed during save") };
    const merged = mergeSavedForm(current, blank, "draft-abc");
    expect(merged.slug).toBe("draft-abc");
    expect(merged.content).toEqual(doc("Typed during save"));
  });

  it("keeps a slug changed on screen during the save", () => {
    const blank = { ...sent, slug: "" };
    const current = { ...blank, slug: "my-own-slug" };
    expect(mergeSavedForm(current, blank, "draft-abc").slug).toBe("my-own-slug");
  });

  it("leaves edits made during the save unsaved", () => {
    const savedSnapshot = JSON.stringify({ ...sent, slug: "hello" });
    const unchanged = mergeSavedForm(sent, sent, "hello");
    const edited = mergeSavedForm({ ...sent, content: doc("More text") }, sent, "hello");
    expect(JSON.stringify(unchanged)).toBe(savedSnapshot);
    expect(JSON.stringify(edited)).not.toBe(savedSnapshot);
  });
});
