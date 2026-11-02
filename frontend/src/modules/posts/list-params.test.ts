import { describe, expect, it } from "vitest";
import { DEFAULT_LIST_STATE, listStateToSearch, readListState, type PostsListState } from "./list-params";

const read = (search: string) => readListState(new URLSearchParams(search));

describe("readListState", () => {
  it("uses the defaults for an empty query string", () => {
    expect(read("")).toEqual(DEFAULT_LIST_STATE);
  });

  it("reads every value the list keeps in the URL", () => {
    expect(read("?status=DRAFT&q=kubernetes&tag=t1&author=a1&sort=wordCount&direction=asc&page=3")).toEqual({
      tab: "DRAFT",
      query: "kubernetes",
      tagId: "t1",
      authorId: "a1",
      sort: { key: "wordCount", direction: "asc" },
      page: 2,
    });
  });

  it("ignores values the list can't use", () => {
    expect(read("?status=deleted&sort=password&direction=sideways&page=abc")).toEqual(DEFAULT_LIST_STATE);
    expect(read("?page=0").page).toBe(0);
    expect(read("?page=-4").page).toBe(0);
    expect(read("?page=1.5").page).toBe(0);
  });
});

describe("listStateToSearch", () => {
  it("is empty when everything is at its default", () => {
    expect(listStateToSearch(DEFAULT_LIST_STATE)).toBe("");
  });

  it("writes only what differs from the defaults, with a one-based page", () => {
    expect(listStateToSearch({ ...DEFAULT_LIST_STATE, tab: "PUBLISHED", page: 1 })).toBe("?status=PUBLISHED&page=2");
  });

  it("writes the sort key and direction together", () => {
    expect(listStateToSearch({ ...DEFAULT_LIST_STATE, sort: { key: "updatedAt", direction: "asc" } })).toBe(
      "?sort=updatedAt&direction=asc",
    );
  });

  it("round-trips through readListState", () => {
    const state: PostsListState = {
      tab: "ARCHIVED",
      query: "a & b",
      tagId: "t1",
      authorId: "a1",
      sort: { key: "title", direction: "asc" },
      page: 4,
    };
    expect(read(listStateToSearch(state))).toEqual(state);
  });
});
