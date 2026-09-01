import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { HMIP_PROFILES } from "../../src/profiles/hmip";

describe("dedicated profile drivers", () => {
  it("reference existing Homey driver directories", async () => {
    await expect(
      Promise.all(
        HMIP_PROFILES.map((profile) =>
          access(resolve("drivers", profile.driverId, "driver.compose.json")),
        ),
      ),
    ).resolves.toBeDefined();
  });
});
