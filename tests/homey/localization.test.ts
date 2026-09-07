import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface TranslatedTitle {
  readonly en?: string;
  readonly de?: string;
  readonly nl?: string;
}

interface CapabilityManifest {
  readonly title?: TranslatedTitle;
  readonly values?: readonly { readonly title?: TranslatedTitle }[];
}

describe("Homey localization", () => {
  it("ships English and German app settings dictionaries", async () => {
    for (const language of ["en", "de"]) {
      const locale = JSON.parse(
        await readFile(resolve("locales", `${language}.json`), "utf8"),
      ) as unknown;
      expect(locale).toHaveProperty("settings.validation.credentials_together");
      expect(locale).toHaveProperty("settings.diagnostics.download");
    }
  });

  it("localizes custom capability titles without stale Dutch fragments", async () => {
    const directory = resolve(".homeycompose", "capabilities");
    for (const file of await readdir(directory)) {
      const manifest = JSON.parse(
        await readFile(resolve(directory, file), "utf8"),
      ) as CapabilityManifest;
      expect(manifest.title?.en, file).toBeTruthy();
      expect(manifest.title?.de, file).toBeTruthy();
      expect(manifest.title?.nl, file).toBeUndefined();
      for (const value of manifest.values ?? []) {
        expect(value.title?.en, file).toBeTruthy();
        expect(value.title?.de, file).toBeTruthy();
        expect(value.title?.nl, file).toBeUndefined();
      }
    }
  });
});
