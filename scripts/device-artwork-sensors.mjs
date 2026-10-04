// Original OpenCCU for Homey artwork, MIT licensed.
// Independently constructed SVG geometry from device form and published dimensions.
// References describe physical products; no image contours are traced or embedded.
// Terminal, lens and housing details are schematic, not installation instructions.

export const sensorReferences = [
  "https://homematic-ip.com/sites/default/files/downloads/hmip-bbl-151333A0-produktdatenblatt.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/hmip-bs2-156757a0-produktdatenblatt.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/hmip-scth230-155592a0-produktdatenblatt.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/hmip-wgc-150586a0-produktdatenblatt.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/hmip-whs2-150842a0-produktdatenblatt.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/152056a0_hmip-swo-b_datasheet_g.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/152057a0_hmip-swo-pl_datasheet_e.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/hmipw-spi-154128a0-datasheet.pdf",
  "https://homematic-ip.com/sites/default/files/downloads/153687a0_160536a0_hmipw-sth_datasheet_g.pdf",
];

const path = (d, attributes = "") => `<path d="${d}" ${attributes}/>`;
const rect = (x, y, width, height, radius = 0, attributes = "") =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ${attributes}/>`;
const ellipse = (x, y, rx, ry, attributes = "") =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${attributes}/>`;
const fine = (geometry) => `<g stroke-width="11">${geometry}</g>`;
const repeat = (count, build) =>
  Array.from({ length: count }, (_, index) => build(index)).join("");
const group = (transform, geometry) =>
  `<g transform="${transform}">${geometry}</g>`;
const systemButton = (x, y, size = 38) =>
  rect(x, y, size, size, 9) + fine(rect(x + 8, y + 8, size - 16, size - 16, 4));

// Shared, shallow wall frame seen slightly from the right. Brand-switch actuators
// accept existing rockers: use a plain installed rocker, without invented symbols.
function wallFrame(content) {
  return group(
    "matrix(1.02 -0.08 0 1.02 72 160)",
    path("M20 0L88 -48H768L700 0M700 20L780 -34V650L700 700") +
      rect(0, 0, 700, 700, 18) +
      fine(rect(21, 21, 658, 658, 9)) +
      content,
  );
}
function rocker() {
  return wallFrame(
    rect(124, 124, 452, 452, 10) +
      fine(path("M135 148H558M558 148V556H143M132 150V547")),
  );
}
function climate(co2) {
  return wallFrame(
    rect(124, 124, 452, 452, 10) +
      fine(path("M138 142H560M560 142V559H140")) +
      (co2
        ? fine(repeat(3, (i) => ellipse(310 + i * 40, 405, 7, 7))) +
          systemButton(329, 476, 42)
        : systemButton(331, 448, 38)),
  );
}
function garageButton() {
  return group(
    "matrix(1 -0.08 0 1 80 190)",
    path("M20 0L105 -64H730Q752 -64 758 -42L768 636L688 705") +
      path("M688 25L768 -40M688 675L766 621") +
      rect(0, 0, 690, 700, 27) +
      // The complete front cover is the large pushbutton, with a narrow surround.
      rect(38, 44, 614, 612, 14) +
      fine(path("M53 61H635V636M657 170L686 170M657 530L686 530")),
  );
}
function heatingSwitch() {
  return group(
    "matrix(1 -0.05 0 1 93 163)",
    path("M18 0L86 -62H685Q704 -62 708 -43V650L644 717") +
      path("M644 18L708 -43") +
      rect(0, 0, 644, 720, 25) +
      fine(path("M15 439H628M20 461H624M635 441L706 386")) +
      systemButton(295, 190, 54) +
      // Cable entries sit on the bottom edge, below the removable cover.
      fine(
        path("M90 699V718M238 699V718M406 699V718M554 699V718") +
          rect(111, 486, 10, 21, 4) +
          rect(523, 486, 10, 21, 4),
      ),
  );
}
function presenceSensor() {
  return (
    // A shallow round housing viewed obliquely, without the old globe symbol.
    path(
      "M141 268C193 135 439 94 643 175C830 250 897 462 825 649C751 840 501 905 300 803C124 713 66 466 141 268Z",
    ) +
    ellipse(470, 492, 355, 350, 'transform="rotate(-18 470 492)"') +
    fine(
      ellipse(468, 490, 319, 318, 'transform="rotate(-18 468 490)"') +
        path("M817 633L833 620"),
    ) +
    ellipse(468, 506, 144, 151, 'transform="rotate(-18 468 506)"') +
    fine(
      ellipse(468, 506, 125, 132, 'transform="rotate(-18 468 506)"') +
        path(
          "M367 474Q467 446 563 469M361 524Q467 553 571 516M424 384Q397 506 434 631M494 376Q530 503 509 623",
        ),
    ) +
    group("rotate(-8 493 718)", systemButton(471, 696, 44))
  );
}

// Cup rotor over a three-stage radiation shield and cylindrical sensor body.
// Basic has no rain gauge; Plus adds a funnel on a second upright. Neither has
// the wind-direction vane belonging to the Pro model.
function weatherCore() {
  return (
    path("M224 437V655Q264 685 304 655V437") +
    fine(path("M236 451V647M285 451V647")) +
    path("M249 673V909M278 673V909M249 907Q264 921 278 907") +
    path("M205 260Q264 222 323 260L350 297Q264 326 178 297Z") +
    path("M206 301L178 345Q264 375 350 345L323 301") +
    path("M207 352L178 395Q264 428 350 395L322 352") +
    path("M210 405L194 436Q264 457 334 436L318 405") +
    fine(
      path(
        "M223 287Q264 299 305 287M216 338Q264 353 312 338M217 389Q264 404 311 389",
      ),
    ) +
    path("M248 242V202Q264 194 280 202V242M246 200L264 175L282 200") +
    path("M247 219L182 200M280 217L346 197M265 185L259 130") +
    ellipse(164, 192, 35, 24, 'transform="rotate(20 164 192)"') +
    path("M130 184Q121 230 167 233Q189 228 196 206") +
    ellipse(365, 184, 34, 25, 'transform="rotate(-18 365 184)"') +
    path("M335 201Q353 229 387 211L399 180") +
    ellipse(257, 113, 30, 22, 'transform="rotate(-10 257 113)"') +
    path("M229 120Q247 151 281 128")
  );
}
function weather(rain) {
  if (!rain) return group("translate(216 -8)", weatherCore());
  return group(
    "translate(78 -4)",
    // Draw the bracket before the two upright bodies to keep it visually simple.
    path("M279 800Q394 868 545 806V729M279 837Q402 904 574 831V730") +
      fine(path("M347 842Q429 870 512 843")) +
      weatherCore() +
      path("M546 590V799M574 590V824") +
      ellipse(560, 416, 127, 42) +
      fine(ellipse(560, 416, 106, 28)) +
      path("M433 416L456 466L472 589Q560 627 648 589L664 466L687 416") +
      fine(path("M458 467Q560 498 663 467M484 495L495 576M636 495L625 576")),
  );
}

export const sensorDrivers = {
  "HmIP-BBL": rocker(),
  "HmIP-BS2": rocker(),
  "HmIP-SCTH230": climate(true),
  "HmIP-WGC": garageButton(),
  "HmIP-WHS2": heatingSwitch(),
  "HmIP-SWO-B": weather(false),
  "HmIP-SWO-PL": weather(true),
  "HmIPW-SPI": presenceSensor(),
  "HmIPW-STH": climate(false),
};
