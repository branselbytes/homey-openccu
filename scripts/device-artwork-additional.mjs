// Original, simplified MIT-licensed enclosure illustrations; no manufacturer assets.
const enclosure =
  '<rect x="110" y="300" width="740" height="360" rx="24"/><path d="M110 415h740"/>';
const lamps = (count) =>
  Array.from(
    { length: count },
    (_, n) => `<circle cx="${170 + n * 55}" cy="370" r="10"/>`,
  ).join("");
const terminals = (count) =>
  Array.from(
    { length: count },
    (_, n) =>
      `<rect x="${155 + n * 55}" y="510" width="30" height="85" rx="4"/>`,
  ).join("");
export const additionalDrivers = {
  "HmIP-FALMOT-C12": enclosure + lamps(12) + terminals(12),
  "HmIP-MIOB":
    enclosure +
    lamps(6) +
    terminals(7) +
    '<rect x="610" y="480" width="175" height="120" rx="10"/>',
  "HM-PB-2-FM":
    '<rect x="180" y="180" width="600" height="600" rx="25"/><rect x="270" y="270" width="420" height="420" rx="10"/><path d="M270 480h420"/><circle cx="480" cy="650" r="8"/>',
};
