import { describe, expect, it } from "vitest";

import {
  transformFromOpenCcu,
  transformToOpenCcu,
} from "../../src/mapping/transforms";

describe("value transforms", () => {
  it("converts inherited units in both directions", () => {
    expect(transformFromOpenCcu("milliamp-to-amp", 750)).toBe(0.75);
    expect(transformToOpenCcu("milliamp-to-amp", 0.75)).toBe(750);
    expect(transformFromOpenCcu("watt-hour-to-kilowatt-hour", 2500)).toBe(2.5);
    expect(transformFromOpenCcu("ratio-to-percent", 0.42)).toBe(42);
  });

  it("rejects invalid numeric values", () => {
    expect(() => transformFromOpenCcu("ratio-to-percent", "invalid")).toThrow(
      /Cannot apply/,
    );
  });
});
