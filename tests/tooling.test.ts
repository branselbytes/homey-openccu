import { describe, expect, it } from "vitest";

describe("project tooling", () => {
  it("runs TypeScript tests", () => {
    expect("OpenCCU for Homey").toContain("OpenCCU");
  });
});
