import { describe, expect, it } from "vitest";

import { reconcileCapabilities } from "../../src/homey/capability-reconciliation";

describe("reconcileCapabilities", () => {
  it("produces stable additions and removals without duplicates", () => {
    expect(
      reconcileCapabilities(
        ["onoff", "measure_power"],
        ["onoff", "dim", "dim"],
      ),
    ).toEqual({ add: ["dim"], remove: ["measure_power"] });
  });
});
