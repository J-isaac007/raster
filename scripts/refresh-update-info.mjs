// Signing an installer changes its bytes, so the hash and size in latest.yml
// (which installed copies check before updating) and the .blockmap (used for
// smaller, differential downloads) no longer match. Run this after replacing
// the installer with its signed copy to bring both up to date.
//
//   node scripts/refresh-update-info.mjs release/Raster-Setup-1.2.3.exe
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
// The same function electron-builder uses, so the output matches its own.
import { buildBlockMap } from 'app-builder-lib/out/targets/blockmap/blockmap.js';

const installer = process.argv[2];
if (!installer) {
  console.error('Usage: node scripts/refresh-update-info.mjs <path to Raster-Setup-x.y.z.exe>');
  process.exit(1);
}

const { size, sha512 } = await buildBlockMap(installer, 'gzip', `${installer}.blockmap`);

const latestPath = join(dirname(installer), 'latest.yml');
const name = basename(installer);
let latest = readFileSync(latestPath, 'utf8');
if (!latest.includes(name)) {
  console.error(`${latestPath} doesn't describe ${name}.`);
  process.exit(1);
}
latest = latest
  .replace(/^(\s*sha512: ).*$/gm, `$1${sha512}`)
  .replace(/^(\s*size: ).*$/gm, `$1${size}`);
writeFileSync(latestPath, latest);
console.log(`Updated ${latestPath} and ${name}.blockmap (size ${size}).`);
