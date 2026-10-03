// Original project artwork, MIT licensed. Geometry is authored here from simple
// primitives, not traced from product images. These are schematic illustrations
// of device form/function, not manufacturer drawings or wiring diagrams.
// Form/function references only (no downloaded/copied/traced artwork):
// https://homematic-ip.com/de/produkt/bewaesserungsaktor
// https://homematic-ip.com/en/product/garage-door-controller
// https://homematic-ip.com/en/product/led-controller-rgbw
// https://homematic-ip.com/sites/default/files/downloads/150842a0_hmip-whs2_um.pdf
// https://homematic-ip.com/sites/default/files/downloads/wn902005-64-6-50.pdf
// https://homematic-ip.com/sites/default/files/downloads/153412a0-a2_hmip-etrv-b-2_datasheet_e.pdf
// https://homematic-ip.com/de/downloads
// Ports and controls are schematic visual cues, not wiring specifications.
// Run: node scripts/generate-device-artwork.mjs
// sharp is supplied by the Homey CLI development dependency; it is not packaged.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { format } from "prettier";

const root = fileURLToPath(new URL("../", import.meta.url));
const rect = (x, y, width, height, radius = 0, extra = "") =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ${extra}/>`;
const circle = (x, y, radius, extra = "") =>
  `<circle cx="${x}" cy="${y}" r="${radius}" ${extra}/>`;
const path = (d, extra = "") => `<path d="${d}" ${extra}/>`;
const line = (x1, y1, x2, y2) => path(`M${x1} ${y1}L${x2} ${y2}`);
const series = (count, build) =>
  Array.from({ length: count }, (_, index) => build(index)).join("");
const dot = (x, y, radius = 12) =>
  circle(x, y, radius, 'fill="#000" stroke="none"');
const arrow = (x, y, up) =>
  path(
    `M${x - 48} ${y + (up ? 24 : -24)}L${x} ${y + (up ? -24 : 24)}L${x + 48} ${y + (up ? 24 : -24)}`,
  );
const terminals = (count, x, y, span) =>
  series(
    count,
    (index) =>
      rect(x + (index * span) / count, y, span / count - 12, 62, 6) +
      line(
        x + (index * span) / count + 12,
        y + 31,
        x + ((index + 1) * span) / count - 24,
        y + 31,
      ),
  );
const wall = (inside) =>
  rect(150, 150, 660, 660, 32) + rect(230, 230, 500, 500, 18) + inside;
const board = (inside) =>
  rect(175, 210, 610, 540, 14) +
  [
    [215, 250],
    [745, 250],
    [215, 710],
    [745, 710],
  ]
    .map(([x, y]) => circle(x, y, 14))
    .join("") +
  inside;
const vents = (count, x, y, width) =>
  series(count, (index) => line(x, y + index * 28, x + width, y + index * 28));

function din(channels, kind = "switch") {
  const content =
    kind === "gateway"
      ? rect(320, 370, 320, 170, 15) +
        rect(355, 410, 100, 80, 5) +
        path("M545 410V490M585 410V490")
      : kind === "bus"
        ? rect(320, 370, 320, 165, 14) + path("M380 410H580M380 460H580")
        : series(Math.min(channels, 8), (index) =>
            circle(
              270 + (index * 420) / Math.max(Math.min(channels, 8) - 1, 1),
              475,
              channels > 8 ? 8 : 18,
            ),
          );
  const terminalCount = Math.min(Math.max(channels, 4), 8);
  return (
    rect(140, 190, 680, 570, 20) +
    rect(200, 150, 560, 60, 8) +
    rect(200, 740, 560, 70, 8) +
    terminals(terminalCount, 200, 250, 570) +
    terminals(terminalCount, 200, 640, 570) +
    content +
    (kind === "dimmer" ? path("M370 575L475 525L585 575Z") : "") +
    (channels === 16 ? series(8, (index) => dot(270 + index * 60, 555, 8)) : "")
  );
}
function flush(inputs, metering = false, compact = false) {
  return (
    rect(185, compact ? 255 : 210, 590, compact ? 450 : 540, 95) +
    terminals(inputs ? 5 : 4, 235, compact ? 305 : 280, 500) +
    circle(480, 555, 48) +
    (metering ? path("M320 535A175 140 0 0 1 640 535M480 555L560 465") : "") +
    (inputs ? path("M280 650H385M575 650H680M390 640L445 605") : "")
  );
}
function plug(dimmer = false) {
  return (
    rect(155, 155, 650, 650, 120) +
    circle(480, 455, 225) +
    rect(270, 325, 420, 260, 55) +
    circle(385, 455, 27) +
    circle(575, 455, 27) +
    line(480, 242, 480, 285) +
    line(480, 625, 480, 668) +
    (dimmer
      ? path("M345 743A155 95 0 0 1 615 743M480 723L550 677")
      : circle(480, 730, 25))
  );
}
function contact() {
  return (
    rect(340, 90, 280, 780, 60) +
    line(365, 645, 595, 645) +
    circle(480, 740, 30) +
    rect(430, 195, 100, 150, 28)
  );
}
function thermostat(evo = false) {
  return (
    rect(205, 245, 560, 425, evo ? 150 : 55) +
    rect(140, 325, 65, 265, 12) +
    path("M140 365H100M140 430H100M140 495H100M140 550H100") +
    (evo
      ? path("M665 270Q600 450 665 640") +
        series(3, (index) => dot(460 + index * 40, 425, 9))
      : rect(300, 325, 360, 155, 14) +
        path("M385 415H420M455 390V440M510 390H545V440H510Z") +
        circle(360, 570, 24) +
        circle(480, 570, 24) +
        circle(600, 570, 24))
  );
}
function weather(rain) {
  return (
    path(
      "M480 860V360M355 870H605M480 365L285 250M480 365L675 250M480 365V155",
    ) +
    path(
      "M180 250Q285 340 390 250M570 250Q675 340 780 250M380 155Q480 245 580 155",
    ) +
    rect(365, 420, 230, 210, 40) +
    vents(4, 385, 455, 190) +
    (rain ? path("M480 690H745V435M650 400H835L795 475H690Z") : "")
  );
}
function climate(co2) {
  return wall(
    vents(5, 310, 490, 340) +
      (co2
        ? circle(480, 365, 66) + circle(480, 365, 20)
        : circle(480, 365, 28)),
  );
}

const drivers = {
  "HmIP-BBL": wall(
    line(260, 480, 700, 480) + arrow(480, 365, true) + arrow(480, 595, false),
  ),
  "HmIP-BS2": wall(
    line(260, 480, 700, 480) + circle(480, 365, 24) + circle(480, 595, 24),
  ),
  "HmIP-DLD":
    rect(275, 115, 410, 750, 125) +
    circle(480, 370, 142) +
    rect(440, 265, 80, 210, 30) +
    circle(415, 685, 24) +
    circle(545, 685, 24),
  "HmIP-DRDI3": din(3, "dimmer"),
  "HmIP-DRG-DALI": din(4, "bus"),
  "HmIP-DRSI4": din(4),
  "HmIP-FS6": flush(false, false, true),
  "HmIP-FSI": flush(true),
  "HmIP-FSI16": flush(true),
  "HmIP-FSI6": flush(true, false, true),
  "HmIP-FSM16": flush(false, true),
  "HmIP-MOD-TM": board(
    rect(320, 330, 300, 210, 8) +
      terminals(5, 245, 600, 480) +
      path("M620 425H850V215M350 540V600M420 540V600M490 540V600"),
  ),
  "HmIP-PCBS2": board(
    rect(265, 335, 170, 220, 10) +
      rect(525, 335, 170, 220, 10) +
      terminals(6, 255, 620, 470) +
      circle(480, 275, 18),
  ),
  "HmIP-PDT": plug(true),
  "HmIP-RGBW":
    rect(80, 310, 800, 340, 30) +
    terminals(2, 110, 410, 160) +
    terminals(5, 575, 410, 275) +
    circle(420, 475, 25) +
    path("M340 560H480"),
  "HmIP-SCTH230": climate(true),
  "HmIP-SWDO-2": contact(),
  "HmIP-SWO-B": weather(false),
  "HmIP-SWO-PL": weather(true),
  "HmIP-USBSM":
    rect(180, 325, 560, 330, 60) +
    rect(740, 380, 125, 220, 8) +
    rect(205, 420, 160, 135, 8) +
    path("M765 430H820M765 495H820") +
    circle(565, 490, 38),
  "HmIP-WGC": wall(rect(295, 295, 370, 370, 28) + circle(480, 480, 85)),
  "HmIP-WHS2":
    rect(180, 165, 600, 630, 45) +
    line(200, 615, 760, 615) +
    circle(370, 455, 46) +
    circle(590, 455, 46) +
    dot(370, 340) +
    dot(590, 340) +
    path("M300 670V725M480 670V725M660 670V725"),
  "HmIP-WSM":
    rect(160, 285, 640, 370, 90) +
    rect(200, 145, 175, 140, 25) +
    line(195, 185, 380, 185) +
    line(195, 225, 380, 225) +
    rect(200, 655, 175, 130, 15) +
    line(195, 710, 380, 710) +
    circle(580, 470, 62),
  "HmIP-eTRV-B-2": thermostat(),
  "HmIP-eTRV-E": thermostat(true),
  "HmIPW-DRAP": din(4, "gateway"),
  "HmIPW-DRI16": din(16),
  "HmIPW-DRS8": din(8),
  "HmIPW-SPI":
    circle(480, 480, 330) +
    circle(480, 480, 245) +
    circle(480, 480, 150) +
    path(
      "M350 405Q480 365 610 405M340 480H620M350 555Q480 595 610 555M430 345Q390 480 430 615M530 345Q570 480 530 615",
    ),
  "HmIPW-STH": climate(false),
  "openccu-heating-group":
    rect(130, 185, 250, 260, 30) +
    rect(580, 185, 250, 260, 30) +
    rect(355, 590, 250, 260, 30) +
    path(
      "M255 285V365M705 285V365M480 680V760M255 445V510H705V445M480 510V590",
    ),
  "openccu-system":
    rect(195, 155, 570, 650, 50) +
    rect(280, 260, 400, 230, 20) +
    path("M325 395H385L425 330L475 430L525 375H635") +
    circle(320, 625, 20) +
    circle(480, 625, 20) +
    circle(640, 625, 20),
};
const models = {
  "HMIP-PSM/assets/models/psm-2.svg": plug(),
  "HMIP-SWDO/assets/models/swdo-a.svg": contact(),
};
function document(name, geometry) {
  return (
    `<!-- ${name}: original OpenCCU project schematic; MIT licensed. Generated by scripts/generate-device-artwork.mjs. -->\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960"><g fill="none" stroke="#000" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">${geometry}</g></svg>\n`
  );
}
async function writeSvg(filename, name, geometry) {
  const svg = await format(document(name, geometry), { parser: "html" });
  await writeFile(filename, svg);
  return svg;
}
for (const [name, geometry] of Object.entries(drivers)) {
  const directory = resolve(root, "drivers", name, "assets");
  await mkdir(resolve(directory, "images"), { recursive: true });
  const svg = await writeSvg(resolve(directory, "icon.svg"), name, geometry);
  for (const [size, pixels] of [
    ["small", 75],
    ["large", 500],
  ]) {
    await sharp(Buffer.from(svg))
      .resize(pixels, pixels)
      .flatten({ background: "#fff" })
      .png()
      .toFile(resolve(directory, "images", `${size}.png`));
  }
  const manifestPath = resolve(root, "drivers", name, "driver.compose.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.images = {
    large: `/drivers/${name}/assets/images/large.png`,
    small: `/drivers/${name}/assets/images/small.png`,
  };
  await writeFile(
    manifestPath,
    await format(JSON.stringify(manifest), { parser: "json" }),
  );
}
for (const [filename, geometry] of Object.entries(models)) {
  const target = resolve(root, "drivers", filename);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeSvg(target, filename.split("/").at(-1), geometry);
}

// Keep the genuinely generic device neutral, but give it neutral catalog images.
{
  const name = "openccu-generic";
  const directory = resolve(root, "drivers", name, "assets");
  const svg = await readFile(resolve(directory, "icon.svg"));
  await mkdir(resolve(directory, "images"), { recursive: true });
  for (const [size, pixels] of [
    ["small", 75],
    ["large", 500],
  ]) {
    await sharp(svg)
      .resize(pixels, pixels)
      .flatten({ background: "#fff" })
      .png()
      .toFile(resolve(directory, "images", `${size}.png`));
  }
  const manifestPath = resolve(root, "drivers", name, "driver.compose.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.images = {
    large: `/drivers/${name}/assets/images/large.png`,
    small: `/drivers/${name}/assets/images/small.png`,
  };
  await writeFile(
    manifestPath,
    await format(JSON.stringify(manifest), { parser: "json" }),
  );
}

// Families use copied, driver-local icons during pairing. Keep generated family
// copies in sync whenever the schematic originals are regenerated.
const familyCopies = {
  "HmIP-SWDO-2": "HMIP-SWDO/assets/models/swdo-2.svg",
  "HmIP-eTRV-B-2": "HmIP-eTRV-2/assets/models/etrv-b-2.svg",
  "HmIP-eTRV-E": "HmIP-eTRV-2/assets/models/etrv-e.svg",
};
for (const [source, target] of Object.entries(familyCopies)) {
  const destination = resolve(root, "drivers", target);
  await mkdir(resolve(destination, ".."), { recursive: true });
  await copyFile(
    resolve(root, "drivers", source, "assets/icon.svg"),
    destination,
  );
}
