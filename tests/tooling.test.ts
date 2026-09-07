import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("project tooling", () => {
  it("uses the stable app identity and guideline-compatible display name", () => {
    const manifest = JSON.parse(
      readFileSync(".homeycompose/app.json", "utf8"),
    ) as Record<string, unknown>;

    expect(manifest.id).toBe("io.github.branselbytes.openccu");
    expect(manifest.name).toEqual({
      en: "OpenCCU Local",
      de: "OpenCCU Local",
    });
    expect(manifest.source).toBe(
      "https://github.com/branselbytes/homey-openccu",
    );
    expect(manifest.support).toBe(
      "https://github.com/branselbytes/homey-openccu/issues",
    );
  });
});
