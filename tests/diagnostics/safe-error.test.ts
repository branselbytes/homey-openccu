import { describe, expect, it } from "vitest";

import { safeErrorKind } from "../../src/diagnostics/safe-error";

describe("safe error logging", () => {
  it("retains a safe class without exposing error details", () => {
    const error = new Error("connect ECONNREFUSED 192.0.2.1 token=secret");

    expect(safeErrorKind(error)).toBe("Error");
    expect(safeErrorKind({ name: "TimeoutError", token: "secret" })).toBe(
      "Error",
    );
  });

  it("rejects an unsafe custom error name", () => {
    const error = new Error("private detail");
    error.name = "Timeout at 192.0.2.1";

    expect(safeErrorKind(error)).toBe("Error");
  });
});
