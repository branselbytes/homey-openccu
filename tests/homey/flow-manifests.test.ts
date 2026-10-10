import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_PROFILES } from "../../src/profiles/registry";

interface FlowManifest {
  readonly title: { readonly en?: string; readonly de?: string };
  readonly titleFormatted?: { readonly en?: string; readonly de?: string };
  readonly args?: readonly {
    readonly name: string;
    readonly type: string;
    readonly filter?: string;
  }[];
}

function flow(kind: string, id: string): FlowManifest {
  return JSON.parse(
    readFileSync(`.homeycompose/flow/${kind}/${id}.json`, "utf8"),
  ) as FlowManifest;
}

function deviceFilter(card: FlowManifest): URLSearchParams {
  const argument = card.args?.find((arg) => arg.type === "device");
  expect(argument?.name).toBe("device");
  return new URLSearchParams(argument?.filter);
}

const thermostatCards = [
  ["set_thermostat_mode", "homematic_thermostat_mode"],
  ["activate_thermostat_boost", "homematic_thermostat_boost"],
  ["set_thermostat_weekprofile", "homematic_thermostat_weekprofile"],
] as const;

describe("Flow catalog", () => {
  it.each(thermostatCards)(
    "%s belongs to compatible drivers while retaining capability filtering and legacy/generic devices",
    (id, capability) => {
      const filter = deviceFilter(flow("actions", id));
      expect(filter.get("capabilities")).toBe(capability);
      const drivers = filter.get("driver_id")?.split("|") ?? [];
      expect(drivers).toContain("openccu-generic");
      expect(drivers).not.toContain("HMIP-PSM");
      expect(drivers).not.toContain("openccu-system");
      for (const profile of ALL_PROFILES) {
        if (!profile.bindings.some((b) => b.capability === capability))
          continue;
        expect(drivers).toContain(profile.driverId);
        for (const legacyId of profile.deviceTypes) {
          if (readdirSync("drivers").includes(legacyId)) {
            expect(drivers).toContain(legacyId);
          }
        }
      }
    },
  );

  it("associates button events with every supported remote/input driver and existing generic devices", () => {
    const filter = deviceFilter(flow("triggers", "hmip_button_pressed"));
    const drivers = filter.get("driver_id")?.split("|") ?? [];
    expect(drivers).toContain("openccu-generic");
    expect(drivers).not.toContain("openccu-system");
    expect(drivers).not.toContain("HmIP-eTRV-2");
    for (const profile of ALL_PROFILES) {
      if (
        (profile.logicalDevices ?? [profile]).some(
          (definition) => (definition.buttonChannels?.length ?? 0) > 0,
        )
      ) {
        expect(drivers).toContain(profile.driverId);
      }
    }
  });

  it("ships English and German titles for every custom Flow card", () => {
    for (const kind of ["triggers", "conditions", "actions"]) {
      for (const file of readdirSync(`.homeycompose/flow/${kind}`)) {
        const card = flow(kind, file.replace(/\.json$/u, ""));
        for (const language of ["en", "de"] as const) {
          expect(card.title[language], file).toBeTruthy();
          expect(card.titleFormatted?.[language], file).toBeTruthy();
        }
      }
    }
  });
});
