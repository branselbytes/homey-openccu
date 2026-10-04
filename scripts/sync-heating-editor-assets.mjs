import { copyFile, mkdir } from "node:fs/promises";

// Homey Compose serves repair assets beside each generated view. Keep their
// authored sources shared with app settings and sync before a Homey build.
const target = new URL(
  "../.homeycompose/drivers/repair/heating_profiles/assets/",
  import.meta.url,
);
await mkdir(target, { recursive: true });
for (const filename of ["heating-editor.js", "heating-editor.css"]) {
  await copyFile(
    new URL(`../assets/${filename}`, import.meta.url),
    new URL(filename, target),
  );
}
