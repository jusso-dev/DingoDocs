import { describe, expect, it } from "vitest";
import { isSafeInternalPath, safeInternalPath } from "./internal-path";

describe("safeInternalPath", () => {
  it("keeps same-origin paths and query strings", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/engagements/abc?view=findings#top")).toBe(
      "/engagements/abc?view=findings#top",
    );
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\\\\evil.example",
    "https://evil.example",
    "/https://evil.example",
    "\\\\evil.example",
    "/\tevil.example",
    "/\nevil.example",
  ])("rejects open-redirect candidate %s", (value) => {
    expect(isSafeInternalPath(value)).toBe(false);
    expect(safeInternalPath(value)).toBe("/dashboard");
  });
});
