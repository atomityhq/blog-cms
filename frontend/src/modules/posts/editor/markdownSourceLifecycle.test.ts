import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/types/api";
import { deleteMarkdownSource, uploadMarkdownSource } from "../api";
import { deleteSourceIfPresent, replaceMarkdownSource } from "./markdownSourceLifecycle";

vi.mock("../api", () => ({ deleteMarkdownSource: vi.fn(), uploadMarkdownSource: vi.fn() }));
const previous = { id: "old", fileName: "old.md", sizeBytes: 1, url: "/old" };
const next = { ...previous, id: "new", fileName: "new.md", url: "/new" };
const file = new File(["# New"], "new.md", { type: "text/markdown" });

describe("Markdown source lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(uploadMarkdownSource).mockResolvedValue(next);
    vi.mocked(deleteMarkdownSource).mockResolvedValue(undefined);
  });

  it("uploads before deleting the old unsaved file", async () => {
    const result = await replaceMarkdownSource(file, previous, null);
    expect(result).toEqual(next);
    expect(deleteMarkdownSource).toHaveBeenCalledExactlyOnceWith("old");
    expect(vi.mocked(uploadMarkdownSource).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deleteMarkdownSource).mock.invocationCallOrder[0]);
  });

  it("keeps the old file when the replacement upload fails", async () => {
    vi.mocked(uploadMarkdownSource).mockRejectedValue(new Error("Upload failed"));
    await expect(replaceMarkdownSource(file, previous, null)).rejects.toThrow("Upload failed");
    expect(deleteMarkdownSource).not.toHaveBeenCalled();
  });

  it("never deletes a source still attached to the saved post", async () => {
    await expect(replaceMarkdownSource(file, previous, "old")).resolves.toEqual(next);
    expect(deleteMarkdownSource).not.toHaveBeenCalled();
  });

  it("does not delete anything for the initial import", async () => {
    await expect(replaceMarkdownSource(file, null, null)).resolves.toEqual(next);
    expect(deleteMarkdownSource).not.toHaveBeenCalled();
  });

  it("treats an already-deleted old upload as successfully removed", async () => {
    vi.mocked(deleteMarkdownSource).mockRejectedValueOnce(new ApiError("NOT_FOUND", "Gone", 404));
    await expect(replaceMarkdownSource(file, previous, null)).resolves.toEqual(next);
    expect(deleteMarkdownSource).toHaveBeenCalledTimes(1);
  });

  it("rolls back the new upload if deleting the old one fails", async () => {
    const error = new ApiError("UNAVAILABLE", "Storage down", 503);
    vi.mocked(deleteMarkdownSource).mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    await expect(replaceMarkdownSource(file, previous, null)).rejects.toBe(error);
    expect(vi.mocked(deleteMarkdownSource).mock.calls).toEqual([["old"], ["new"]]);
  });

  it("preserves both failures when rollback cleanup also fails", async () => {
    const error = new Error("Old delete failed");
    const cleanup = new Error("New cleanup failed");
    vi.mocked(deleteMarkdownSource).mockRejectedValueOnce(error).mockRejectedValueOnce(cleanup);
    await expect(replaceMarkdownSource(file, previous, null)).rejects.toMatchObject({ errors: [error, cleanup] });
  });

  it("only ignores 404 and preserves reference protection and auth errors", async () => {
    for (const status of [401, 403, 409, 503]) {
      const error = new ApiError("ERROR", "Cannot delete", status);
      vi.mocked(deleteMarkdownSource).mockRejectedValueOnce(error);
      await expect(deleteSourceIfPresent("old")).rejects.toBe(error);
    }
  });
});
