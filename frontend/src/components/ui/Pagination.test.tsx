import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PageMeta } from "@/types/api";
import { Pagination } from "./Pagination";

function render(meta: PageMeta) {
  const html = renderToStaticMarkup(<Pagination meta={meta} onPageChange={() => {}} noun="posts" />);
  const text = html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const disabled = (label: string) => new RegExp(`<button[^>]*aria-label="${label}"[^>]*\\sdisabled=""`).test(html);
  return { text, previousDisabled: disabled("Previous page"), nextDisabled: disabled("Next page") };
}

describe("Pagination", () => {
  it("shows the range and position of a middle page", () => {
    expect(render({ page: 1, size: 10, totalElements: 25, totalPages: 3 })).toEqual({
      text: "11–20 of 25 posts 2 / 3",
      previousDisabled: false,
      nextDisabled: false,
    });
  });

  it("shows a partial last page and disables Next", () => {
    expect(render({ page: 2, size: 10, totalElements: 25, totalPages: 3 })).toEqual({
      text: "21–25 of 25 posts 3 / 3",
      previousDisabled: false,
      nextDisabled: true,
    });
  });

  it("clamps a page past the end instead of showing an invalid range", () => {
    // The response for page 2 after its only post was deleted.
    expect(render({ page: 1, size: 10, totalElements: 10, totalPages: 1 })).toEqual({
      text: "1–10 of 10 posts 1 / 1",
      previousDisabled: true,
      nextDisabled: true,
    });
  });

  it("shows an empty list as zero of zero", () => {
    expect(render({ page: 0, size: 10, totalElements: 0, totalPages: 0 })).toEqual({
      text: "0–0 of 0 posts 0 / 0",
      previousDisabled: true,
      nextDisabled: true,
    });
  });
});
