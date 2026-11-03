import { describe, expect, it } from "vitest";
import { uniqueIdealForEntries } from "./idealFor";

describe("uniqueIdealForEntries", () => {
  it("trims entries and ignores empty values", () => {
    expect(uniqueIdealForEntries(" , CISO, , Head of IT, ")).toEqual(["CISO", "Head of IT"]);
  });

  it("deduplicates without regard to casing and preserves the first display value", () => {
    expect(uniqueIdealForEntries("CISO, ciso, CIO, CISO, cio")).toEqual(["CISO", "CIO"]);
  });
});
