import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const [flag, destination, ...extra] = process.argv.slice(2);
if (flag !== "--output" || !destination || extra.length !== 0) {
  throw new Error(
    "Usage: node scripts/create-garage-demo.mjs --output /tmp/openccu-garage-demo",
  );
}
const output = path.resolve(destination);
if (output === root || output.startsWith(`${root}${path.sep}`)) {
  throw new Error(
    "Choose an output directory outside the production repository",
  );
}
try {
  const info = await lstat(output);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await readdir(output)).length > 0
  ) {
    throw new Error(
      "Refusing to overwrite an existing file, symlink, or nonempty directory",
    );
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await mkdir(output, { recursive: true });

async function copy(relative, target = relative) {
  const destination = path.join(output, target);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, relative), destination, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
}
async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), "utf8"));
}
async function writeJson(relative, value) {
  const destination = path.join(output, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
  });
}

// Explicit allowlist: no settings, env files, cache, app credentials or other drivers.
for (const relative of [
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "src",
  "drivers/HmIP-MOD-HO",
  "assets/icon.svg",
  "assets/images",
  "assets/garage-door.svg",
  "assets/garage-ventilation.svg",
  "assets/garage-light.svg",
  "scripts/garage-demo/simulation.ts",
])
  await copy(relative);
await copy("scripts/garage-demo/app.ts.template", "app.ts");
await copy(
  "tests/fixtures/hoermann-mod-ho.json",
  "fixtures/hoermann-mod-ho.json",
);
await copy("tests/fixtures/README.md", "fixtures/PROVENANCE.md");

const driver = await json("drivers/HmIP-MOD-HO/driver.compose.json");
for (const capability of driver.capabilities.filter((id) =>
  id.startsWith("homematic_"),
)) {
  await copy(`.homeycompose/capabilities/${capability}.json`);
}
for (const relative of [
  ".homeycompose/flow/actions/set_garage_door_command.json",
  ".homeycompose/flow/actions/activate_garage_ventilation.json",
  ".homeycompose/flow/conditions/garage_door_state_is.json",
  ".homeycompose/flow/actions/turn_garage_light_on.json",
  ".homeycompose/flow/actions/turn_garage_light_off.json",
  ".homeycompose/flow/actions/toggle_garage_light.json",
  ".homeycompose/flow/conditions/garage_light_is_on.json",
  ".homeycompose/flow/triggers/homematic_garage_light_true.json",
  ".homeycompose/flow/triggers/homematic_garage_light_false.json",
  ".homeycompose/flow/triggers/homematic_garage_state_changed.json",
])
  await copy(relative);

const baseManifest = await json(".homeycompose/app.json");
const manifest = {
  id: "io.github.branselbytes.openccu-demo",
  version: baseManifest.version,
  compatibility: baseManifest.compatibility,
  sdk: 3,
  platforms: baseManifest.platforms ?? ["local"],
  runtime: baseManifest.runtime ?? "nodejs",
  name: { en: "OpenCCU Garage Simulation", de: "OpenCCU Garagen-Simulation" },
  description: {
    en: "Simulate one garage door and its light without a CCU connection",
    de: "Ein Garagentor mit Licht ohne CCU-Verbindung simulieren",
  },
  category: ["tools"],
  permissions: [],
  images: baseManifest.images,
  brandColor: baseManifest.brandColor,
  author: baseManifest.author,
};
await writeJson(".homeycompose/app.json", manifest);
await writeJson("app.json", manifest);
const basePackage = await json("package.json");
const packageJson = {
  name: "openccu-garage-simulation",
  version: basePackage.version,
  private: true,
  description: "Development-only in-memory OpenCCU garage simulation",
  main: "app.js",
  scripts: { build: "tsc", typecheck: "tsc --noEmit" },
  dependencies: basePackage.dependencies,
  devDependencies: basePackage.devDependencies,
  license: "MIT",
  engines: basePackage.engines,
};
await writeJson("package.json", packageJson);
const lock = await json("package-lock.json");
lock.name = packageJson.name;
lock.version = packageJson.version;
lock.packages[""].name = packageJson.name;
lock.packages[""].version = packageJson.version;
await writeJson("package-lock.json", lock);
const tsconfig = await json("tsconfig.json");
tsconfig.include = [
  "app.ts",
  "src/**/*.ts",
  "drivers/**/*.ts",
  "scripts/garage-demo/*.ts",
];
await writeJson("tsconfig.json", tsconfig);
await writeFile(
  path.join(output, ".homeyignore"),
  "README.txt\nTHIRD_PARTY_NOTICES.md\npackage-lock.json\nfixtures/PROVENANCE.md\n",
  { flag: "wx" },
);
await writeFile(
  path.join(output, "README.txt"),
  `OpenCCU Garage Simulation (development only)

This separate app reuses the production HmIP-MOD-HO driver, mapping and runtime.
Its RPC client runs entirely in memory. It has no CCU settings or network server.
Fixture provenance: fixtures/PROVENANCE.md. It cannot control a physical door.

Install dependencies: npm ci --ignore-scripts
Build/check: npm run typecheck; homey app build; homey app validate
Installing on a Homey requires the owner's approval: homey app install
Then add a device from OpenCCU Garage Simulation, selecting HmIP-MOD-HO.
The device is named Garage door (Simulation) / Garagentor (Simulation).
The light and door controls belong to this single simulated garage device.
Door travel takes 1.2 seconds; stop leaves position unknown during travel.
State resets to closed/light-off when this simulation app restarts.

Verify the native device view, light button, door commands and Flow cards.
This proves Homey UI/Flow behaviour against simulated values, not physical hardware.
Uninstall this separate demo app when finished. Production OpenCCU settings are unused.
`,
  { flag: "wx" },
);
console.log(`Created isolated garage simulation: ${output}`);
console.log(
  `App ID: ${manifest.id}. No installation or external changes performed.`,
);
