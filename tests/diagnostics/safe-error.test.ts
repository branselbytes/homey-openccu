import { describe, expect, it } from "vitest";

import { ProtocolError } from "../../src/protocol/errors";
import {
  safeErrorKind,
  safeErrorSummary,
} from "../../src/diagnostics/safe-error";

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

it("reports protocol codes without leaking messages, causes or arbitrary properties", () => {
  const error = new ProtocolError(
    "remote-fault",
    "private address and password",
    new Error("secret"),
    -2,
  );
  expect(safeErrorSummary(error)).toBe(
    "ProtocolError code=remote-fault faultCode=-2",
  );
  expect(safeErrorSummary(new ProtocolError("timeout", "secret"))).toBe(
    "ProtocolError code=timeout",
  );
  expect(safeErrorSummary(new Error("secret"))).toBe("Error");
  Object.defineProperty(error, "code", { value: "secret" });
  expect(safeErrorSummary(error)).toBe("ProtocolError");
});

it("does not invoke accessors or emit invalid fault values", () => {
  const error = new ProtocolError("remote-fault", "secret");
  Object.defineProperty(error, "faultCode", {
    get() {
      throw Error("private");
    },
    configurable: true,
  });
  expect(safeErrorSummary(error)).toBe("ProtocolError code=remote-fault");
  Object.defineProperty(error, "faultCode", { value: Infinity });
  expect(safeErrorSummary(error)).toBe("ProtocolError code=remote-fault");
});
