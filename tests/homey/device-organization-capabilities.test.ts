import { describe, expect, it } from "vitest";

import type { OpenCcuMetadata } from "../../src/domain/model";
import {
  OPENCCU_FUNCTIONS_CAPABILITY,
  OPENCCU_ROOM_CAPABILITY,
  resolveOrganizationCapabilities,
} from "../../src/homey/device-organization-capabilities";
import type { ResolvedDeviceMapping } from "../../src/mapping/device-resolver";

const metadata: OpenCcuMetadata = {
  names: new Map(),
  rooms: new Map([
    ["Workshop", ["301:1"]],
    ["Ground floor", ["301:1", "302:1"]],
    ["Kitchen", ["301:2"]],
  ]),
  functions: new Map([
    ["Security", ["301:1"]],
    ["Light", ["301:2"]],
  ]),
  programs: [],
  systemVariables: [],
};

describe("resolveOrganizationCapabilities", () => {
  it("creates deterministic device Flow tags for matching OpenCCU channels", () => {
    const mapping = mappingFor("301:1");

    expect(resolveOrganizationCapabilities(metadata, "301", mapping)).toEqual({
      [OPENCCU_ROOM_CAPABILITY]: "Ground floor, Workshop",
      [OPENCCU_FUNCTIONS_CAPABILITY]: "Security",
    });
  });

  it("keeps logical outputs scoped to their own channels", () => {
    const mapping = {
      ...mappingFor("301:2"),
      logicalId: "output-2",
      nameChannel: 2,
    };

    expect(resolveOrganizationCapabilities(metadata, "301", mapping)).toEqual({
      [OPENCCU_ROOM_CAPABILITY]: "Kitchen",
      [OPENCCU_FUNCTIONS_CAPABILITY]: "Light",
    });
  });

  it("does not add empty tags to unassigned devices", () => {
    expect(
      resolveOrganizationCapabilities(metadata, "999", mappingFor("999:1")),
    ).toEqual({});
  });
});

function mappingFor(channelAddress: string): ResolvedDeviceMapping {
  return {
    driverId: "test",
    generic: false,
    bindings: [
      {
        capability: "onoff",
        channelAddress,
        parameter: "STATE",
        readable: true,
        writable: false,
        transform: "boolean",
      },
    ],
    buttonEvents: [],
    decisions: [],
  };
}
