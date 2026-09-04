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

  it("converts numeric OpenCCU enums to Homey string IDs and back", () => {
    expect(transformFromOpenCcu("enum-number-to-string", 2)).toBe("2");
    expect(transformToOpenCcu("enum-number-to-string", "2")).toBe(2);
  });

  it("converts smoke detector status to a Homey alarm", () => {
    expect(transformFromOpenCcu("smoke-status-to-boolean", "IDLE_OFF")).toBe(
      false,
    );
    expect(
      transformFromOpenCcu("smoke-status-to-boolean", "PRIMARY_ALARM"),
    ).toBe(true);
  });
});
