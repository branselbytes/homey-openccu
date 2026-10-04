import { describe, expect, it, vi } from "vitest";

import { ProtocolError, toProtocolError } from "../../src/protocol/errors";
import { sanitizeXmlRpcErrorDiagnostics } from "../../src/protocol/xmlrpc/diagnostics";

describe("safe XML-RPC faults", () => {
  it.each([0, -1, -2_147_483_648, 2_147_483_647])(
    "retains fault code %i without server text or causes",
    (faultCode) => {
      const error = Object.assign(
        new Error("private token=secret host=192.0.2.1"),
        {
          code: faultCode,
          faultCode,
          faultString: "private address and credentials",
        },
      );
      const result = toProtocolError(error, "XML-RPC setValue");

      expect(result).toMatchObject({
        code: "remote-fault",
        faultCode,
        message: `XML-RPC setValue failed (CCU fault code ${faultCode})`,
      });
      expect(result.cause).toBeUndefined();
      expect(JSON.stringify(result)).not.toMatch(
        /private|secret|192\.0\.2\.1/u,
      );
    },
  );

  it.each([
    "0",
    "secret",
    null,
    {},
    NaN,
    Infinity,
    -Infinity,
    1.5,
    2_147_483_648,
    -2_147_483_649,
  ])("does not interpret invalid fault code %j", (faultCode) => {
    const result = toProtocolError(
      { faultCode, faultString: "private" },
      "XML-RPC setValue",
    );
    expect(result.code).toBe("transport");
    expect(result.faultCode).toBeUndefined();
    expect(result.message).toBe("XML-RPC setValue failed");
  });

  it("does not infer a fault from an arbitrary message or numeric error code", () => {
    const result = toProtocolError(
      Object.assign(new Error("401 unauthorized faultCode=-1"), { code: -1 }),
      "XML-RPC setValue",
    );
    expect(result.code).toBe("transport");
    expect(result.faultCode).toBeUndefined();
  });

  it("does not invoke a fault-code accessor", () => {
    const getFaultCode = vi.fn(() => {
      throw new Error("private");
    });
    const error: object = Object.defineProperty({}, "faultCode", {
      get: getFaultCode,
    });
    expect(toProtocolError(error, "XML-RPC setValue").code).toBe("transport");
    expect(getFaultCode).not.toHaveBeenCalled();
  });

  it("preserves existing protocol errors and abort classification", () => {
    const existing = new ProtocolError("timeout", "XML-RPC setValue timed out");
    expect(toProtocolError(existing, "XML-RPC setValue")).toBe(existing);
    expect(
      toProtocolError(
        Object.assign(new Error("private"), { name: "AbortError" }),
        "XML-RPC setValue",
      ).code,
    ).toBe("aborted");
  });
});

describe("XML-RPC diagnostic projection", () => {
  it("keeps only allowlisted protocol facts", () => {
    expect(
      sanitizeXmlRpcErrorDiagnostics({
        method: "setValue",
        code: "remote-fault",
        faultCode: 0,
        message: "private",
        faultString: "private",
        cause: { password: "secret" },
        address: "private",
        params: ["private"],
      }),
    ).toEqual({ method: "setValue", code: "remote-fault", faultCode: 0 });
  });

  it.each([
    { method: "private", code: "transport" },
    { method: "setValue", code: "private" },
    { method: "a".repeat(100_000), code: "transport" },
    { method: {}, code: [] },
    null,
    "private",
  ])("rejects arbitrary methods and codes", (value) => {
    expect(sanitizeXmlRpcErrorDiagnostics(value)).toBeUndefined();
  });

  it("omits invalid or irrelevant fault codes", () => {
    expect(
      sanitizeXmlRpcErrorDiagnostics({
        method: "setValue",
        code: "remote-fault",
        faultCode: "private",
      }),
    ).toEqual({ method: "setValue", code: "remote-fault" });
    expect(
      sanitizeXmlRpcErrorDiagnostics({
        method: "setValue",
        code: "transport",
        faultCode: 1,
      }),
    ).toEqual({ method: "setValue", code: "transport" });
  });
});
