// Original MIT-licensed geometry. Product photographs and manuals are consulted
// only to identify enclosure proportions and visible controls, never traced.
// Decorative labels, manufacturer logos and circuit diagrams are omitted.
const path = (d, extra = "") => `<path d="${d}" ${extra}/>`;
const rect = (x, y, width, height, radius = 0) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/>`;
const circle = (x, y, radius) => `<circle cx="${x}" cy="${y}" r="${radius}"/>`;
const detail = (geometry) => `<g stroke-width="10">${geometry}</g>`;
const repeat = (count, draw) =>
  Array.from({ length: count }, (_, index) => draw(index)).join("");

// A common 72 x 90 mm / four-module enclosure, including the DRS8. Channel
// count does not determine enclosure width. Connections are recognition cues,
// deliberately simplified; these drawings are not wiring diagrams.
const terminalBank = (x, y, count, pitch = 58) =>
  detail(
    rect(x, y, count * pitch, 61, 3) +
      repeat(count, (index) => {
        const left = x + index * pitch;
        return (
          (index ? path(`M${left} ${y}v61`) : "") +
          rect(left + 16, y + 21, pitch - 32, 22, 3)
        );
      }),
  );

function din(top, bottom, gateway = false) {
  return (
    path("M205 300V175H705V300M205 650V795H705V650") +
    path("M205 175L265 135H765V755L705 795M705 175L765 135") +
    path("M725 300L785 260V610L725 650M185 300L245 260H785") +
    rect(185, 300, 540, 350, 8) +
    detail(
      rect(325, 385, 260, 176, 5) +
        rect(239, 459, 40, 40, 9) +
        rect(629, 409, 38, 40, 7) +
        rect(629, 510, 38, 40, 7) +
        path("M434 795V824H481V795"),
    ) +
    top +
    bottom +
    (gateway
      ? detail(
          rect(246, 690, 57, 57, 3) +
            rect(330, 690, 57, 57, 3) +
            path("M610 703h66v43h-66zM626 703v-10h34v10"),
        )
      : "")
  );
}

// The earlier FSI/FSM family has a chamfered moulding and a mounting eye.
// The front is mostly a printed label, not a meter or a row of pushbuttons.
function flushClassic(withInput) {
  return (
    path(
      "M252 275H679Q698 275 710 292L768 373Q778 388 778 410V650Q778 675 750 675H532V630H380V675H183Q158 675 158 650V410Q158 391 169 375L229 294Q238 275 252 275Z",
    ) +
    path(
      "M252 275L317 230H744Q763 230 775 247L833 328Q843 343 843 365V605Q843 626 821 641L762 680M710 292L775 247M778 410L843 365",
    ) +
    path("M399 675V725A48 48 0 0 0 495 725V675") +
    detail(
      circle(447, 725, 23) +
        circle(682, 335, 15) +
        path("M780 443L813 420V457L780 480M780 521L813 498V535L780 558") +
        (withInput
          ? path("M389 633H522V677H472V698H438V677H389Z")
          : path("M403 631H508")),
    )
  );
}

function flushCompact(withInput) {
  return (
    path(
      "M312 170H610Q635 170 653 188L731 263Q751 282 751 312V749Q751 775 724 775H239Q213 775 213 749V312Q213 285 234 265L291 191Q300 180 312 170Z",
    ) +
    path(
      "M312 170L367 132H665Q691 132 709 150L786 225Q806 244 806 274V711Q806 731 788 744L741 778M653 188L709 150M751 312L806 274",
    ) +
    detail(
      path("M632 181V769M240 390H364Q378 390 390 408V740Q390 753 377 753H239") +
        circle(306, 370, 43) +
        terminalBank(388, 350, withInput ? 4 : 3, 51) +
        path("M245 278L288 233M678 228L720 270M665 750H713"),
    )
  );
}

function tormaticModule() {
  return (
    path(
      "M218 401Q218 383 238 383H686Q706 383 706 403V763Q706 784 685 784H239Q218 784 218 763Z",
    ) +
    path(
      "M228 386L284 345H739Q760 345 760 366V725Q760 745 745 754L700 783M706 403L760 365",
    ) +
    detail(circle(324, 461, 15) + circle(594, 461, 15)) +
    path(
      "M294 345V306C294 260 588 310 588 231C588 193 537 188 496 190H424",
      'stroke-width="22"',
    ) +
    rect(302, 157, 122, 65, 8) +
    path("M302 172H243V207H302M257 182H286")
  );
}

function pcbs2() {
  return (
    path("M257 188H665L717 151H309L257 188V792H665L717 755V151M665 188V792") +
    detail(
      circle(286, 221, 12) +
        circle(635, 760, 12) +
        rect(323, 253, 220, 189, 4) +
        path("M323 253L350 232H570V421L543 442M543 253L570 232") +
        rect(308, 498, 43, 39, 4) +
        circle(330, 516, 11) +
        rect(407, 498, 43, 39, 4) +
        circle(429, 516, 11) +
        rect(508, 498, 43, 39, 4) +
        circle(530, 516, 11) +
        circle(601, 452, 25) +
        circle(601, 568, 25) +
        path("M576 452v43q25 22 50 0v-43M576 568v43q25 22 50 0v-43") +
        terminalBank(277, 678, 3, 44) +
        terminalBank(418, 678, 2, 44) +
        terminalBank(515, 678, 3, 44),
    ) +
    path("M293 597V318Q293 291 317 291M639 595V312Q639 280 614 280H591")
  );
}

function rgbw() {
  return (
    path(
      "M112 390Q112 365 136 365H784Q810 365 810 390V555Q810 579 784 579H136Q112 579 112 555Z",
    ) +
    path(
      "M122 370L167 333Q180 322 197 322H839Q865 322 865 347V513Q865 537 845 551L800 583M810 390L865 347",
    ) +
    detail(
      path("M166 374V569M310 375V569M644 375V569M768 375V569") +
        circle(191, 471, 11) +
        circle(743, 471, 11) +
        rect(466, 461, 22, 22, 5) +
        path("M123 419h18M123 525h18M786 419h18M786 525h18"),
    )
  );
}

function usbsm() {
  return (
    path("M145 347H747L806 305H204Z M145 347V662H747L806 620V305M747 347V662") +
    detail(
      circle(175, 377, 13) +
        circle(714, 631, 13) +
        path("M216 378v42q20 14 40 0v-42M216 378q20-15 40 0q-20 15-40 0") +
        path("M629 384v42q20 14 40 0v-42M629 384q20-15 40 0q-20 15-40 0") +
        circle(402, 437, 30) +
        path("M372 437v58q30 22 60 0v-58") +
        circle(494, 501, 30) +
        path("M464 501v58q30 22 60 0v-58") +
        circle(591, 501, 30) +
        path("M561 501v58q30 22 60 0v-58") +
        rect(323, 537, 63, 55, 3),
    ) +
    rect(117, 516, 112, 68, 21) +
    detail(path("M137 548H209")) +
    path(
      "M691 490H814V582H691Z M691 490L732 460H855V552L814 582M814 490L855 460",
    ) +
    detail(path("M711 514H793V556H711Z")) +
    path("M442 621Q447 591 473 592H671Q694 592 694 622")
  );
}

export const electricalDrivers = {
  "HmIP-DRDI3": din(
    terminalBank(230, 204, 2) +
      terminalBank(405, 204, 2) +
      terminalBank(570, 204, 2),
    terminalBank(240, 702, 2) + terminalBank(568, 702, 2),
  ),
  "HmIP-DRG-DALI": din(terminalBank(248, 204, 2), terminalBank(568, 702, 2)),
  "HmIP-DRSI4": din(
    terminalBank(230, 204, 2) +
      terminalBank(405, 204, 2) +
      terminalBank(570, 204, 2),
    terminalBank(230, 702, 2) +
      terminalBank(405, 702, 2) +
      terminalBank(570, 702, 2),
  ),
  "HmIPW-DRAP": din(terminalBank(239, 208, 4, 36), "", true),
  "HmIPW-DRI16": din(
    terminalBank(233, 205, 8, 56),
    terminalBank(233, 702, 8, 56),
  ),
  "HmIPW-DRS8": din(
    terminalBank(230, 204, 2) +
      terminalBank(405, 204, 2) +
      terminalBank(570, 204, 2),
    terminalBank(230, 702, 2) +
      terminalBank(405, 702, 2) +
      terminalBank(570, 702, 2),
  ),
  "HmIP-FS6": flushCompact(false),
  // HmIP-FSI is a retained generic family ID; no separate verified enclosure.
  "HmIP-FSI": flushClassic(true),
  "HmIP-FSI16": flushClassic(true),
  "HmIP-FSI6": flushCompact(true),
  "HmIP-FSM16": flushClassic(false),
  "HmIP-MOD-TM": tormaticModule(),
  "HmIP-PCBS2": pcbs2(),
  "HmIP-RGBW": rgbw(),
  "HmIP-USBSM": usbsm(),
};

export const electricalReferences = [
  "https://homematic-ip.com/en/product/dimming-actuator-din-rail-mounting-3-channels",
  "https://homematic-ip.com/en/product/dali-gateway",
  "https://homematic-ip.com/en/product/wired-access-point",
  "https://homematic-ip.com/en/product/wired-switching-actuator-8-channels",
  "https://homematic-ip.com/sites/default/files/downloads/152250a0_hmipw-dri16_um_e.pdf",
  "https://homematic-ip.com/en/product/switch-actuator-push-button-input-6-flush-mount",
  "https://homematic-ip.com/de/produkt/schaltaktor-6-unterputz",
  "https://homematic-ip.com/sites/default/files/downloads/hmip-fsi16-154346a0-datasheet.pdf",
  "https://homematic-ip.com/en/product/led-controller-rgbw",
  "https://media.elv.com/file/250205_um_funkmodul.pdf",
  "https://media.elv.com/file/152697_km.pdf",
  "https://media.elv.com/file/251987_hmip_usbsm.pdf",
];
