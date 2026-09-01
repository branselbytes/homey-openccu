import { describe, expect, it } from "vitest";

import { MappingDecisionLog } from "../../src/mapping/decision";

describe("MappingDecisionLog", () => {
  it("keeps a bounded explanation history", () => {
    const log = new MappingDecisionLog(1);
    log.add({
      channelAddress: "001:1",
      parameter: "STATE",
      kind: "generic",
      reason: "boolean",
    });
    log.add({
      channelAddress: "001:2",
      parameter: "LEVEL",
      kind: "unsupported",
      reason: "ambiguous",
    });
    expect(log.list()).toEqual([
      {
        channelAddress: "001:2",
        parameter: "LEVEL",
        kind: "unsupported",
        reason: "ambiguous",
      },
    ]);
  });
});
