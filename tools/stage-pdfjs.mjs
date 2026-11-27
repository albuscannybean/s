import { cp, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const source = process.env.LMN_PDFJS_MODULE_DIR
  ?? fileURLToPath(new URL('../node_modules/pdfjs-dist/', import.meta.url));
const target = fileURLToPath(new URL('../apps/web/vendor/pdfjs/', import.meta.url));
const expected = JSON.parse(await readFile(new URL('../package.json', import.meta.url))).dependencies['pdfjs-dist'];
const installed = JSON.parse(await readFile(join(source, 'package.json')));
if (installed.version !== expected) throw new Error('Install pdfjs-dist ' + expected + ' before building the reader.');

await mkdir(target, { recursive: true });
const assets = ['build/pdf.min.mjs', 'build/pdf.worker.min.mjs', 'LICENSE', 'cmaps', 'standard_fonts', 'wasm', 'iccs'];
await Promise.all(assets.map(asset => cp(join(source, asset), join(target, asset), { recursive: true })));

