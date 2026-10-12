// Generate the reviewed capability-level Flow catalog, retaining existing cards.
// Run npm run build first. No network access or application writes.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { ALL_PROFILES } = require("../.homeybuild/src/profiles/registry.js");
const excluded = new Set([
  "homematic_rhs_state",
  "homematic_garage_state",
  "homematic_garage_light",
  "openccu_room",
  "openccu_functions",
]);
const definitions = [];
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
for (const file of fs.readdirSync(".homeycompose/capabilities")) {
  const base = file.replace(/\.json$/, "");
  const cap = JSON.parse(fs.readFileSync(".homeycompose/capabilities/" + file));
  if (!cap.getable || excluded.has(base)) continue;
  const ids =
    base === "homematic_particulate"
      ? [
          "homematic_particulate.pm1",
          "homematic_particulate.pm25",
          "homematic_particulate.pm10",
        ]
      : [base];
  for (const capability of ids) {
    const drivers = base.startsWith("openccu_")
      ? ["openccu-system"]
      : [
          ...new Set(
            ALL_PROFILES.filter((p) =>
              (p.logicalDevices ?? [p]).some((d) =>
                d.bindings.some((b) => b.capability === capability),
              ),
            ).map((p) => p.driverId),
          ),
          "openccu-generic",
        ];
    if (!drivers.length) throw new Error("No driver for " + capability);
    const options = JSON.parse(
      fs.readFileSync("drivers/" + drivers[0] + "/driver.compose.json"),
    ).capabilitiesOptions?.[capability];
    const title = options?.title ?? cap.title;
    const id = capability.replaceAll(".", "_");
    const filter =
      "driver_id=" + drivers.sort().join("|") + "&capabilities=" + capability;
    const dev = {
      name: "device",
      type: "device",
      filter,
      title: { en: "Device", de: "Gerät" },
    };
    const trigger = "ccu_" + id + "_changed",
      condition = "ccu_" + id + "_is";
    const values = cap.values ?? [];
    definitions.push({
      capability,
      type: cap.type,
      title,
      trigger,
      condition,
      ...(values.length ? { values } : {}),
    });
    const tokens = [
      {
        name: "value",
        type: cap.type === "enum" ? "string" : cap.type,
        title,
        example:
          cap.type === "number"
            ? 1
            : cap.type === "boolean"
              ? true
              : (values[0]?.id ?? ""),
      },
    ];
    if (capability === "homematic_passage_count")
      tokens.push({
        name: "direction",
        type: "string",
        title: {
          en: "Last reported direction value",
          de: "Zuletzt gemeldeter Richtungswert",
        },
        example: "Yes",
      });
    if (cap.type !== "number")
      tokens.push({
        name: "status",
        type: "string",
        title: { en: "Status text", de: "Statustext" },
        example:
          cap.type === "boolean" ? "Active" : (values[0]?.title.en ?? ""),
      });
    write(".homeycompose/flow/triggers/" + trigger + ".json", {
      title: { en: title.en + " changed", de: title.de + " hat sich geändert" },
      titleFormatted: {
        en: title.en + " changed",
        de: title.de + " hat sich geändert",
      },
      tokens,
      args: [dev],
    });
    const args =
      cap.type === "number"
        ? [
            {
              name: "operator",
              type: "dropdown",
              title: { en: "Comparison", de: "Vergleich" },
              values: [
                ["eq", "=", "gleich"],
                ["gt", ">", "größer als"],
                ["lt", "<", "kleiner als"],
                ["gte", "≥", "größer oder gleich"],
                ["lte", "≤", "kleiner oder gleich"],
              ].map(([id, en, de]) => ({ id, label: { en, de } })),
            },
            { name: "value", type: "number", title },
          ]
        : [
            {
              name: "value",
              type: "dropdown",
              title,
              values:
                cap.type === "boolean"
                  ? [
                      { id: "true", label: { en: "Yes", de: "Ja" } },
                      { id: "false", label: { en: "No", de: "Nein" } },
                    ]
                  : values.map((v) => ({ id: v.id, label: v.title })),
            },
          ];
    write(".homeycompose/flow/conditions/" + condition + ".json", {
      title: { en: "Check " + title.en, de: title.de + " prüfen" },
      titleFormatted: {
        en:
          title.en +
          " !{{is|is not}} " +
          (cap.type === "number" ? "[[operator]] " : "") +
          "[[value]]",
        de:
          title.de +
          " !{{ist|ist nicht}} " +
          (cap.type === "number" ? "[[operator]] " : "") +
          "[[value]]",
      },
      args: [dev, ...args],
    });
  }
}
fs.writeFileSync(
  "src/homey/status-flow-definitions.ts",
  "// Generated by scripts/generate-status-flows.mjs from capability definitions.\nexport interface StatusFlowDefinition { readonly capability: string; readonly type: string; readonly title: {readonly en: string; readonly de: string}; readonly trigger: string; readonly condition: string; readonly values?: readonly { readonly id: string; readonly title: { readonly en: string; readonly de?: string } }[]; }\nexport const STATUS_FLOW_DEFINITIONS: readonly StatusFlowDefinition[] = " +
    JSON.stringify(definitions, null, 2) +
    ";\n",
);
const defs = definitions.find(
  (d) => d.capability === "homematic_detection_active",
);
const filter = JSON.parse(
  fs.readFileSync(".homeycompose/flow/conditions/" + defs.condition + ".json"),
).args[0];
write(".homeycompose/flow/actions/set_detection_active.json", {
  title: {
    en: "Set detection active",
    de: "Erkennung aktivieren/deaktivieren",
  },
  titleFormatted: {
    en: "Set detection to [[active]]",
    de: "Erkennung auf [[active]] setzen",
  },
  args: [
    filter,
    {
      name: "active",
      type: "dropdown",
      title: { en: "Detection", de: "Erkennung" },
      values: [
        { id: "true", label: { en: "Active", de: "Aktiv" } },
        { id: "false", label: { en: "Inactive", de: "Inaktiv" } },
      ],
    },
  ],
});
const boost = JSON.parse(
  fs.readFileSync(".homeycompose/flow/actions/activate_thermostat_boost.json"),
);
boost.title = {
  en: "Deactivate thermostat boost",
  de: "Thermostat-Boost deaktivieren",
};
boost.titleFormatted = { ...boost.title };
write(".homeycompose/flow/actions/deactivate_thermostat_boost.json", boost);
console.log(definitions.length + " status functions generated");
