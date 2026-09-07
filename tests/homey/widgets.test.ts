import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Homey widgets", () => {
  for (const id of ["service-messages", "system-status"]) {
    it(`ships a complete, localized ${id} widget`, async () => {
      const directory = resolve("widgets", id);
      const manifest = JSON.parse(
        await readFile(resolve(directory, "widget.compose.json"), "utf8"),
      ) as {
        name?: { en?: string; de?: string };
        api?: Readonly<Record<string, unknown>>;
      };
      const html = await readFile(
        resolve(directory, "public", "index.html"),
        "utf8",
      );

      expect(manifest.name?.en).toBeTruthy();
      expect(manifest.name?.de).toBeTruthy();
      expect(Object.keys(manifest.api ?? {})).not.toHaveLength(0);
      expect(html).toContain("function onHomeyReady(Homey)");
      expect(html).not.toContain("innerHTML");
      await expect(
        Promise.all([
          access(resolve(directory, "preview-light.png")),
          access(resolve(directory, "preview-dark.png")),
        ]),
      ).resolves.toBeDefined();
    });
  }

  it("lets the system-status content determine its height without inner scrolling", async () => {
    const directory = resolve("widgets", "system-status");
    const manifest = JSON.parse(
      await readFile(resolve(directory, "widget.compose.json"), "utf8"),
    ) as { height?: unknown };
    const html = await readFile(
      resolve(directory, "public", "index.html"),
      "utf8",
    );

    expect(manifest.height).toBeUndefined();
    expect(html).toContain("HomeyApi.setHeight");
    expect(html).not.toContain("max-height:");
    expect(html).not.toContain("overflow-y:");
  });
});
