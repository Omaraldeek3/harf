// Publishes the Arabic part of the catalogue as a small static file, so other
// tools can offer Harf's fonts: Cut Studio's Arabic lettering reads
// /catalog/arabic.json and loads each font straight from /fonts/. Colour
// fonts are left out, since they are pictures more than outlines.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { updated, commit, fonts } = JSON.parse(await readFile(path.join(root, 'src/data/fonts.json'), 'utf8'));

/** A short licence name for the label; the file itself is linked beside it. */
function licenceName(font) {
  if (font.licenseKind) return font.licenseKind;
  const file = font.license.split('/').pop();
  if (file === 'OFL.txt') return 'OFL-1.1';
  if (file === 'UFL.txt') return 'UFL-1.0';
  return 'Open';
}

const arabic = fonts
  .filter(font => font.languages?.includes('ar') && !font.color)
  .map(font => ({
    id: font.id,
    family: font.family,
    category: font.category,
    latin: font.languages.includes('en'),
    weights: font.weights,
    weightRange: font.weightRange,
    files: font.files.map(({ path: file, weight, variable }) => ({ path: file, weight, variable })),
    designers: font.designers,
    licence: licenceName(font),
    licenceFile: font.license,
  }))
  .sort((a, b) => a.family.localeCompare(b.family));

await mkdir(path.join(root, 'public/catalog'), { recursive: true });
await writeFile(path.join(root, 'public/catalog/arabic.json'), `${JSON.stringify({ updated, commit, count: arabic.length, fonts: arabic })}\n`);
console.log(`Published ${arabic.length} Arabic fonts to public/catalog/arabic.json.`);
