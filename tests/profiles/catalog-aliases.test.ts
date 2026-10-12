import { describe, expect, it } from "vitest";
import { CATALOG_ALIASES } from "../../src/profiles/catalog-aliases";
import { ProfileRegistry } from "../../src/profiles/registry";
const registry = new ProfileRegistry();
describe("shared-descriptor model aliases", () => {
  it.each(Object.entries(CATALOG_ALIASES))(
    "keeps %s on the verified family's channel layout",
    (model, evidence) => {
      const alias = registry.find(model)!;
      const base = registry.find(evidence.base)!;
      expect(alias).toBeDefined();
      expect(alias.driverId).toBe(base.driverId);
      expect(alias.bindings).toEqual(base.bindings);
      expect(alias.logicalDevices).toEqual(base.logicalDevices);
      expect(alias.configurationParameters).toEqual(
        base.configurationParameters,
      );
      expect(evidence.descriptor).toMatch(/^device_[\w]+\.xml$/);
    },
  );
  it("does not match unknown product suffixes by prefix", () => {
    expect(registry.find("HmIP-HDM99")).toBeUndefined();
    expect(registry.find("HmIP-DLP-UNKNOWN")).toBeUndefined();
  });
});
