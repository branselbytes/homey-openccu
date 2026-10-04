// Original OpenCCU project artwork, MIT licensed.
// These symbolic previews contain no text, screenshots, or third-party artwork.
// Homey App Store guidelines: 1024px square, transparent, light/dark variants.
// https://apps.developer.homey.app/app-store/guidelines#1.10.-widget-previews
// Run: node scripts/generate-widget-previews.mjs
// sharp is supplied by the Homey CLI development dependency; it is not packaged.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const themes = {
  light: {
    card: "#ffffff",
    inset: "#f4f4f7",
    primary: "#a6a6af",
    secondary: "#d4d4dc",
    blue: "#0082ff",
    green: "#26b765",
    orange: "#ff9f0a",
    shadow: 0.12,
  },
  dark: {
    card: "#303035",
    inset: "#3c3c43",
    primary: "#aaaab3",
    secondary: "#62626b",
    blue: "#2194ff",
    green: "#30d178",
    orange: "#ffad2e",
    shadow: 0.28,
  },
};

const rect = (x, y, width, height, radius, fill) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`;
const circle = (x, y, radius, fill) =>
  `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`;
const bar = (x, y, width, height, fill) =>
  rect(x, y, width, height, height / 2, fill);
const icons = {
  hub: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6M9 11h6M9 15h2"/><circle cx="15" cy="18" r=".5"/>',
  devices:
    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  warning: '<path d="M12 3 22 21H2L12 3ZM12 9v5M12 17v.2"/>',
  gauge:
    '<path d="M3 18a10 10 0 1 1 18 0M12 5v2M5.5 8l1.4 1.4M18.5 8l-1.4 1.4M12 16l4-5"/><circle cx="12" cy="16" r="1"/>',
  radio:
    '<path d="M6 4a11 11 0 0 0 0 16M18 4a11 11 0 0 1 0 16M9 7a7 7 0 0 0 0 10M15 7a7 7 0 0 1 0 10M12 13v8"/><circle cx="12" cy="10" r="1.5"/>',
  battery:
    '<rect x="6" y="4" width="12" height="18" rx="2"/><path d="M10 2h4M12 8v5M12 17v.2"/>',
};

function icon(name, x, y, size, color) {
  return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</g>`;
}

function metric(theme, x, y, name, color, valueWidth) {
  return (
    rect(x, y, 328, 184, 28, theme.inset) +
    icon(name, x + 28, y + 28, 42, color) +
    bar(x + 92, y + 40, 172, 18, theme.secondary) +
    bar(x + 28, y + 111, valueWidth, 30, theme.primary)
  );
}

function systemStatus(theme) {
  return (
    icon("hub", 174, 256, 56, theme.blue) +
    bar(258, 274, 286, 24, theme.primary) +
    circle(816, 286, 14, theme.green) +
    metric(theme, 164, 356, "devices", theme.blue, 96) +
    metric(theme, 532, 356, "warning", theme.orange, 62) +
    metric(theme, 164, 568, "gauge", theme.green, 128) +
    metric(theme, 532, 568, "radio", theme.orange, 104)
  );
}

function message(theme, y, name, width) {
  return (
    rect(164, y, 696, 172, 28, theme.inset) +
    icon(name, 194, y + 35, 46, theme.orange) +
    bar(272, y + 38, width, 23, theme.primary) +
    bar(272, y + 90, 348, 18, theme.secondary) +
    bar(272, y + 125, 180, 13, theme.secondary)
  );
}

function serviceMessages(theme) {
  return (
    icon("warning", 178, 260, 48, theme.orange) +
    bar(258, 274, 362, 24, theme.primary) +
    message(theme, 356, "battery", 264) +
    message(theme, 556, "warning", 322)
  );
}

for (const [name, draw] of Object.entries({
  "system-status": systemStatus,
  "service-messages": serviceMessages,
})) {
  for (const [mode, theme] of Object.entries(themes)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
          <feGaussianBlur stdDeviation="22"/>
        </filter>
      </defs>
      <g opacity="${theme.shadow}" filter="url(#shadow)">${rect(116, 228, 792, 600, 64, "#000000")}</g>
      ${rect(116, 212, 792, 600, 64, theme.card)}
      ${draw(theme)}
    </svg>`;
    await sharp(Buffer.from(svg))
      .png()
      .toFile(resolve(root, "widgets", name, `preview-${mode}.png`));
  }
}
