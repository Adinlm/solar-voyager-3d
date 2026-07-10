import { readdir, readFile, writeFile } from 'node:fs/promises';

const sourceDirectory = new URL('../src/', import.meta.url);
const outputFile = new URL('../src/main.js', import.meta.url);
const partNames = (await readdir(sourceDirectory))
  .filter((name) => /^main\.part\d+\.js$/.test(name))
  .sort();

if (partNames.length === 0) {
  throw new Error('No se encontraron fragmentos src/main.partXX.js');
}

const parts = await Promise.all(
  partNames.map((name) => readFile(new URL(name, sourceDirectory), 'utf8'))
);

await writeFile(outputFile, parts.join(''), 'utf8');
console.log(`Motor ensamblado: ${partNames.length} fragmentos -> src/main.js`);
