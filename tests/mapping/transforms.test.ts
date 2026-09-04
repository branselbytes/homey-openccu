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
    expect(transformFromOpenCcu("liter-to-cubic-meter", 2500)).toBe(2.5);
    expect(transformToOpenCcu("liter-to-cubic-meter", 2.5)).toBe(2500);
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

  it("derives on/off from a dim level and writes exact boundary levels", () => {
    expect(transformFromOpenCcu("positive-number-to-boolean", 0)).toBe(false);
    expect(transformFromOpenCcu("positive-number-to-boolean", 0.42)).toBe(true);
    expect(transformToOpenCcu("positive-number-to-boolean", false)).toBe(0);
    expect(transformToOpenCcu("positive-number-to-boolean", true)).toBe(1);
    expect(() => transformToOpenCcu("positive-number-to-boolean", 0.5)).toThrow(
      /Cannot apply/,
    );
  });

  it("maps OpenCCU cover activity to Homey's movement state", () => {
    expect(transformFromOpenCcu("activity-state-to-cover-state", "UP")).toBe(
      "up",
    );
    expect(transformFromOpenCcu("activity-state-to-cover-state", "DOWN")).toBe(
      "down",
    );
    expect(
      transformFromOpenCcu("activity-state-to-cover-state", "STABLE"),
    ).toBe("idle");
  });

  it("maps HmIP lock and garage states to native Homey booleans", () => {
    expect(transformFromOpenCcu("lock-state-to-boolean", "LOCKED")).toBe(true);
    expect(transformFromOpenCcu("lock-state-to-boolean", 2)).toBe(false);
    expect(transformToOpenCcu("lock-state-to-boolean", true)).toBe("LOCKED");
    expect(transformToOpenCcu("lock-state-to-boolean", false)).toBe("UNLOCKED");
    expect(transformFromOpenCcu("garage-door-state-to-closed", "CLOSED")).toBe(
      true,
    );
    expect(
      transformFromOpenCcu(
        "garage-door-state-to-closed",
        "VENTILATION_POSITION",
      ),
    ).toBe(false);
  });
});
