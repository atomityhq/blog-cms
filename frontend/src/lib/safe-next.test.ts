import { describe, expect, it } from "vitest";
import { DEFAULT_NEXT, safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths unchanged, with their query string and hash", () => {
    expect(safeNext("/posts")).toBe("/posts");
    expect(safeNext("/posts/new")).toBe("/posts/new");
    expect(safeNext("/posts?tab=draft&page=2")).toBe("/posts?tab=draft&page=2");
    expect(safeNext("/posts/123/edit#title")).toBe("/posts/123/edit#title");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back to /posts when there is no next", () => {
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
    expect(DEFAULT_NEXT).toBe("/posts");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("http://evil.com/posts")).toBe(DEFAULT_NEXT);
    expect(safeNext("//evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("//evil.com/posts")).toBe(DEFAULT_NEXT);
    expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_NEXT);
  });

  it("rejects a backslash after the leading slash (browsers read it as //)", () => {
    expect(safeNext("/\\evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\\\\evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\\/evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("/posts\\evil.com")).toBe(DEFAULT_NEXT);
  });

  it("rejects tabs, line breaks and other control characters (browsers strip them)", () => {
    expect(safeNext("/\t/evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\n/evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\r/evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("/\t\\evil.com")).toBe(DEFAULT_NEXT);
    expect(safeNext("/posts\u0000")).toBe(DEFAULT_NEXT);
    expect(safeNext("/posts\u007f")).toBe(DEFAULT_NEXT);
  });

  it("rejects values that don't start with a slash, including leading whitespace", () => {
    expect(safeNext(" /posts")).toBe(DEFAULT_NEXT);
    expect(safeNext("\t/posts")).toBe(DEFAULT_NEXT);
    expect(safeNext("posts")).toBe(DEFAULT_NEXT);
    expect(safeNext("evil.com")).toBe(DEFAULT_NEXT);
  });

  it("keeps encoded backslashes and slashes, which stay on the same site", () => {
    expect(safeNext("/%5Cevil.com")).toBe("/%5Cevil.com");
    expect(safeNext("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
  });

  it("uses the given fallback instead of /posts", () => {
    expect(safeNext("//evil.com", "/")).toBe("/");
    expect(safeNext(undefined, "/dashboard")).toBe("/dashboard");
    expect(safeNext("/posts", "/")).toBe("/posts");
  });
});
