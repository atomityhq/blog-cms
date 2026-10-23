import { describe, expect, it } from "vitest";
import type { ContentDoc } from "@/types/content";
import { areValuesEqual } from "./editor-form-utils";

describe("areValuesEqual", () => {
  it("treats objects with differently ordered keys as equal", () => {
    const first = {
      type: "paragraph",
      attrs: { id: "one", level: 2 },
    };
    const second = {
      attrs: { level: 2, id: "one" },
      type: "paragraph",
    };

    expect(areValuesEqual(first, second)).toBe(true);
  });

  it("treats nested objects with differently ordered keys as equal", () => {
    const first = {
      content: {
        marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }],
        text: "Example",
      },
      type: "doc",
    };
    const second = {
      type: "doc",
      content: {
        text: "Example",
        marks: [{ attrs: { target: "_blank", href: "https://example.com" }, type: "link" }],
      },
    };

    expect(areValuesEqual(first, second)).toBe(true);
  });

  it("compares arrays in order", () => {
    expect(areValuesEqual([1, 2], [2, 1])).toBe(false);
    expect(
      areValuesEqual(
        [{ id: "first" }, { id: "second" }],
        [{ id: "second" }, { id: "first" }],
      ),
    ).toBe(false);
  });

  it("treats arrays of reordered-but-equivalent objects as equal", () => {
    expect(
      areValuesEqual(
        [{ text: "one", type: "text" }, { text: "two", type: "text" }],
        [{ type: "text", text: "one" }, { type: "text", text: "two" }],
      ),
    ).toBe(true);
  });

  it("detects genuinely different text or metadata", () => {
    expect(
      areValuesEqual(
        { text: "Hello", type: "paragraph" },
        { text: "Goodbye", type: "paragraph" },
      ),
    ).toBe(false);

    expect(
      areValuesEqual(
        { title: "Original title", slug: "original-title" },
        { title: "New title", slug: "original-title" },
      ),
    ).toBe(false);
  });

  it("detects missing keys and different values", () => {
    expect(areValuesEqual({ title: "Post", featured: true }, { title: "Post" })).toBe(false);
    expect(areValuesEqual({ title: "Post" }, { title: "Post", tags: [] })).toBe(false);
    expect(areValuesEqual({ count: 1 }, { count: 2 })).toBe(false);
  });

  it("treats identical structured documents as equal", () => {
    expect(
      areValuesEqual(
        { content: [{ text: "Hello", type: "text" }], type: "doc" },
        { content: [{ text: "Hello", type: "text" }], type: "doc" },
      ),
    ).toBe(true);
  });

  it("handles null and primitive edge cases", () => {
    expect(areValuesEqual(null, null)).toBe(true);
    expect(areValuesEqual(null, {})).toBe(false);
    expect(areValuesEqual(undefined, undefined)).toBe(true);
    expect(areValuesEqual(NaN, NaN)).toBe(true);
    expect(areValuesEqual(0, "0")).toBe(false);
    expect(areValuesEqual(false, true)).toBe(false);
  });

  it("models the rich-text key-order regression", () => {
    const saved: ContentDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2, id: "intro" },
          content: [{ type: "text", text: "Hello" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "A link",
              marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }],
            },
          ],
        },
      ],
    };

    // PostgreSQL JSONB can return the same document with object keys in a different order.
    const fromDatabase: ContentDoc = {
      content: [
        {
          content: [{ text: "Hello", type: "text" }],
          attrs: { id: "intro", level: 2 },
          type: "heading",
        },
        {
          content: [
            {
              marks: [{ attrs: { target: "_blank", href: "https://example.com" }, type: "link" }],
              text: "A link",
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
    };

    expect(areValuesEqual(saved, fromDatabase)).toBe(true);
    expect(
      areValuesEqual(saved, {
        ...fromDatabase,
        content: fromDatabase.content?.map((node) =>
          node.type === "heading"
            ? { ...node, attrs: { ...node.attrs, level: 3 } }
            : node,
        ),
      }),
    ).toBe(false);
  });
});
