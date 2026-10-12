// Read-only comparison against a local pydevccu checkout. Run npm run build first.
// node scripts/audit-reference-catalog.mjs /path/to/pydevccu > report.json
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { ProfileRegistry } = require("../.homeybuild/src/profiles/registry.js");
const registry = new ProfileRegistry();
const reference = process.argv[2];
if (!reference) throw new Error("Provide a pydevccu source directory");
const infrastructure = new Set(["HmIP-CCU3", "HmIP-HAP", "HmIP-RFUSB"]);
const models = new Set();
for (const file of await readdir(resolve(reference, "device_descriptions"))) {
  if (!file.endsWith(".json")) continue;
  const descriptions = JSON.parse(
    await readFile(resolve(reference, "device_descriptions", file), "utf8"),
  );
  for (const d of descriptions)
    if (!d.PARENT && /^hmip/i.test(d.TYPE))
      models.add(d.TYPE.trim().split(/\s+/, 1)[0]);
}
const devices = [...models].sort().map((model) => {
  const p = registry.find(model);
  return {
    model,
    status: p
      ? "profile"
      : infrastructure.has(model)
        ? "infrastructure"
        : "missing",
    ...(p ? { driver: p.driverId, profile: p.id } : {}),
  };
});
console.log(
  JSON.stringify(
    {
      reference: "pydevccu 6fe7695f049219c77cbda2b60131fdf61d836000",
      scope:
        "Recorded Homematic IP radio/Wired model catalog; profile presence is not full feature parity or physical validation",
      total: devices.length,
      profiled: devices.filter((d) => d.status === "profile").length,
      infrastructure: devices.filter((d) => d.status === "infrastructure")
        .length,
      missing: devices.filter((d) => d.status === "missing").length,
      devices,
    },
    null,
    2,
  ),
);
