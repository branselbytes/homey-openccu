// Original MIT-licensed product illustrations. Coordinates are authored from
// physical proportions and functional features, not traced image contours.
const p = (d, extra = "") => `<path d="${d}" ${extra}/>`;
const r = (x, y, w, h, radius = 0, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ${extra}/>`;
const e = (x, y, rx, ry, extra = "") =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${extra}/>`;
const detail = (geometry) => `<g stroke-width="10">${geometry}</g>`;
const repeat = (count, draw) =>
  Array.from({ length: count }, (_, i) => draw(i)).join("");

function contact() {
  return (
    p(
      "M395 114Q395 91 418 84L515 55Q547 48 561 70L570 91V822Q570 846 548 855L443 892Q419 898 402 881L390 862V138Q390 122 395 114Z",
    ) +
    p("M399 112L506 83Q532 78 535 102V850Q535 872 515 879M535 102L566 90") +
    detail(p("M399 742L535 719M399 163L535 142M535 718L568 706")) +
    r(442, 773, 39, 46, 9) +
    detail(p("M441 833L486 823M548 348V398"))
  );
}

function socket(compact) {
  const body = compact
    ? p(
        "M126 285Q118 238 165 213L646 77Q690 65 724 93L857 194Q890 221 884 263L867 703Q866 747 824 767L379 889Q331 902 301 873L163 757Q133 732 135 690Z",
      ) +
      p(
        "M164 213L305 321Q326 338 356 330L853 192M305 321L301 843Q300 871 326 884",
      ) +
      p(
        "M356 330L821 211Q854 203 854 240L838 702Q837 728 808 737L372 862Q339 871 338 838V367Q338 337 356 330Z",
      )
    : p(
        "M129 242Q130 204 170 194L614 84Q658 73 689 94L836 194Q866 216 865 250V728Q865 768 826 780L387 885Q345 897 315 875L166 770Q138 750 136 717Z",
      ) +
      p(
        "M170 194L326 300Q353 319 389 309L835 198M326 300L326 853M389 309Q368 316 368 348V843Q368 873 393 876",
      ) +
      detail(p("M181 244L174 704Q174 725 195 740L283 801"));
  return (
    body +
    `<g transform="matrix(0.96 -0.25 0 1 76 54)">` +
    e(561, 557, 198, 211) +
    detail(e(566, 561, 172, 185)) +
    p(
      "M444 438Q468 414 499 414H638Q666 415 685 441V675Q663 700 635 700H502Q470 700 446 677Z",
      'stroke-width="10"',
    ) +
    e(502, 558, 20, 29) +
    e(630, 558, 20, 29) +
    detail(p("M559 366V407M580 366V407M559 711V749M580 711V749")) +
    r(696, 400, 38, 43, 9) +
    `</g>`
  );
}

function basicThermostat() {
  return (
    p(
      "M269 167Q278 130 329 118L568 75Q617 67 650 98L739 185Q765 211 775 268L795 661Q796 751 744 809L682 865Q656 889 612 891L380 879Q302 866 260 795Q213 717 208 612L217 306Q222 215 269 167Z",
    ) +
    p(
      "M273 162L540 148Q593 146 620 192Q669 281 672 430L690 679Q690 791 639 849Q615 876 578 883",
    ) +
    detail(p("M540 148L614 94M672 430L773 372M689 681L795 642")) +
    p(
      "M287 311Q287 281 317 279L557 273Q587 273 594 303L609 536Q611 560 585 563L316 568Q287 566 284 540Z",
    ) +
    detail(r(307, 313, 263, 164, 8)) +
    r(416, 506, 49, 43, 9) +
    p(
      "M218 640Q403 665 690 638M345 655L348 862M522 654L535 875",
      'stroke-width="12"',
    ) +
    detail(p("M276 742H310M560 733H600M580 713V753"))
  );
}

function evoThermostat() {
  return (
    // Threaded collar and the narrow, continuous front casing.
    e(471, 128, 131, 41) +
    p("M340 128V233Q343 276 473 276Q600 274 602 233V128") +
    detail(
      repeat(10, (i) => {
        const x = 356 + i * 25;
        return p(`M${x} 162V227`);
      }),
    ) +
    p(
      "M313 271Q328 249 362 252L569 249Q616 243 647 265L695 302Q715 319 715 357V793Q715 830 680 846L630 869Q609 879 573 879L325 864Q287 861 275 838L258 803V337Q258 296 313 271Z",
    ) +
    p(
      "M313 271Q298 316 306 385V802Q306 840 325 864M569 249Q610 271 613 326V822Q613 864 595 879M613 326L708 312",
    ) +
    detail(
      p(
        "M330 334V743Q330 787 355 815H547Q576 813 576 779V327M331 386H575M331 745H575",
      ),
    ) +
    r(424, 681, 51, 53, 10) +
    // A restrained segment-display cue, without logos or rendered text.
    detail(
      p(
        "M416 446H467M475 457V488M415 498H466M405 511V543M416 554H467M510 457V488M510 511V543",
      ),
    )
  );
}

function lock() {
  return (
    p(
      "M292 282Q289 150 381 93Q469 39 559 76L642 112Q719 149 722 269V797Q722 847 677 865L615 892Q596 901 566 898L326 884Q287 879 286 838Z",
    ) +
    p("M325 177Q373 104 459 119Q571 138 589 267L598 845Q598 886 574 898") +
    e(438, 286, 143, 160) +
    detail(p("M316 275Q312 400 424 431Q530 455 577 351M593 818L719 773")) +
    r(421, 546, 50, 52, 11) +
    r(421, 623, 50, 52, 11) +
    r(421, 700, 50, 52, 11) +
    detail(p("M433 569V562Q446 547 458 562V569M433 721V714Q446 699 458 714"))
  );
}

function waterValve() {
  return (
    // The valve has a cube-shaped controller and vertically opposed water ports.
    e(574, 107, 111, 35) +
    p("M463 107V220Q464 251 575 251Q684 251 685 220V107") +
    detail(repeat(9, (i) => p(`M${480 + i * 23} 145V213`))) +
    p(
      "M209 284L541 210Q652 192 768 250Q800 268 812 305Q845 411 840 608Q836 675 790 708L645 774Q620 786 579 789L249 772Q176 769 154 711Q123 624 132 421Q136 315 209 284Z",
    ) +
    p("M209 284L562 303Q610 307 623 357Q659 524 637 698Q630 764 579 789") +
    detail(
      p(
        "M562 303L751 246M640 688L828 631M180 366Q185 327 229 330L529 346Q567 351 575 393Q600 530 583 685Q579 727 535 730L248 716Q206 715 191 675Q161 534 180 366Z",
      ),
    ) +
    r(300, 451, 155, 155, 31) +
    detail(r(322, 473, 111, 111, 18)) +
    p("M635 777V837Q636 864 700 864Q767 864 768 837V721") +
    detail(p("M637 811Q705 832 767 805M637 832Q705 855 767 826"))
  );
}

function heatingGroup() {
  return (
    // A virtual group gets a radiator motif, not an invented physical product.
    p(
      "M115 353V703Q115 731 146 731H807Q845 731 845 692V353M114 408H73V476H114M843 408H885V476H844",
    ) +
    repeat(5, (i) => r(177 + i * 129, 290, 92, 474, 42)) +
    detail(p("M197 789V842M776 789V842")) +
    p("M386 175L480 98L574 175V244H386Z") +
    detail(p("M454 244V196H506V244"))
  );
}

function system() {
  return (
    // A neutral local hub with status indicators; no OpenCCU branding.
    p(
      "M127 340Q128 293 178 279L642 158Q687 147 721 171L835 246Q870 269 870 316V664Q870 706 831 718L369 845Q325 856 293 834L158 742Q128 721 128 685Z",
    ) +
    p("M178 279L310 369Q332 383 367 374L836 248M310 369V803Q310 835 340 847") +
    detail(p("M159 341V665Q159 684 178 697L262 755M355 773L821 646")) +
    `<g transform="matrix(1 -0.27 0 1 0 0)">` +
    r(417, 581, 331, 206, 25) +
    detail(p("M458 688H510L550 630L595 727L639 677H710")) +
    [449, 582, 715].map((x) => e(x, 853, 13, 13)).join("") +
    `</g>`
  );
}

export const householdDrivers = {
  "HmIP-DLD": lock(),
  "HmIP-PDT": socket(false),
  "HmIP-SWDO-2": contact(),
  "HmIP-WSM": waterValve(),
  "HmIP-eTRV-B-2": basicThermostat(),
  "HmIP-eTRV-E": evoThermostat(),
  "openccu-heating-group": heatingGroup(),
  "openccu-system": system(),
};

export const householdModels = {
  "HMIP-PSM/assets/models/psm-2.svg": socket(true),
  "HMIP-SWDO/assets/models/swdo-a.svg": contact(),
};

export const householdReferences = [
  "https://homematic-ip.com/de/produkt/tuerschlossantrieb",
  "https://homematic-ip.com/de/produkt/schalt-mess-steckdose",
  "https://homematic-ip.com/de/produkt/bewaesserungsaktor",
  "https://homematic-ip.com/en/product/radiator-thermostat-basic",
  "https://homematic-ip.com/en/product/radiator-thermostat-evo",
  "https://homematic-ip.com/sites/default/files/downloads/157857a0_160027a0_hmip-swdo-2_datasheet_e.pdf",
];
