import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TEXTBOOK_EDITIONS } from '../packages/learning/textbook-editions.js';

const [auditDir, outputDir, correctionsPath] = process.argv.slice(2);
if (!auditDir || !outputDir) throw new Error('Usage: node tools/generate-private-course-text.mjs AUDIT_DIR PRIVATE_OUTPUT_DIR [CORRECTIONS_JSON]');
const target = resolve(outputDir);
const publicRoot = resolve('apps/web');
if (target === publicRoot || target.startsWith(publicRoot + (process.platform === 'win32' ? '\\' : '/'))) {
  throw new Error('Write the personal study copy outside the public website directory.');
}
const format = 'lmn-course-text/1';
const source = async (...parts) => readFile(resolve(auditDir, ...parts), 'utf8');
const corrections = correctionsPath ? JSON.parse(await readFile(correctionsPath, 'utf8')) : {};
const scannedEditions = new Set(['algebra', 'analysis', 'ode']);
const compact = value => value.replace(/\s+/g, '').normalize('NFKC');
const han = '[\\p{Script=Han}，。；、！：？）】》]';
const nextHan = '[\\p{Script=Han}，。；、！：？（【《]';
const languageSpacing = new RegExp('(?<='+han+')[ \\t]+(?='+nextHan+')','gu');

function pageLines(page) {
  let blank = true;
  return page.split(/\r?\n/).flatMap(raw => {
    if (!raw.trim()) { blank = true; return []; }
    const value = { text: raw.trim(), indent: raw.search(/\S/), blank };
    blank = false;
    return [value];
  });
}

function ocrLines(lines) {
  return lines.map(([left, top, width, height, text], index) => ({
    text: text.trim(),
    blank: index === 0 || top - lines[index - 1][1] > Math.max(0.04, height * 2.2),
    indent: left * 100
  })).filter(line => !!line.text);
}

function headingIndex(lines, section) {
  const title = compact(section.title).replace(/[$\\]/g, '');
  const number = compact(section.number);
  if (!title || !number) return -1;
  return lines.findIndex(line => {
    const text = compact(line.text);
    const prefix = /^(?:第|§)*/.exec(text)[0].length;
    const n = number.replace('.', '[.．·]');
    return new RegExp('^' + n + '(?![.．·]?[0-9])').test(text.slice(prefix))
      && text.length <= title.length + number.length + 12
      && text.includes(title.slice(0, Math.max(2, title.length - 2)));
  });
}

function paragraphs(lines, scanned) {
  const blocks = [];
  const baseline = Math.min(...lines.filter(({text}) => text.length >= 20).map(line => line.indent));
  let text = '';
  for (const line of lines) {
    const value = line.text.replace(/[\u0000-\u0008\u000B\u000E-\u001F]/g, '').replace(languageSpacing, ' ');
    const newParagraph = line.blank || line.indent > baseline + (scanned ? 2.1 : 1)
      || /^(?:定义|命题|推论|定理|例题|习题|证明)\s*\d/.test(value);
    if (newParagraph && text) { blocks.push(text.replace(languageSpacing, '').trim()); text = ''; }
    if (/[A-Za-z]{2}-$/.test(text) && /^[a-z]/.test(value)) text = text.slice(0, -1) + value;
    else text += (text ? ' ' : '') + value;
  }
  if (text) blocks.push(text.replace(languageSpacing, '').trim());
  return blocks;
}

await mkdir(target, { recursive: true });
const manifest = { format, editions: [] };
for (const edition of TEXTBOOK_EDITIONS) {
  const scanned = scannedEditions.has(edition.id);
  const raw = scanned
    ? JSON.parse(await source('..', 'ocr-boxes29-' + edition.id + '.json'))
    : (await source(edition.id + '.txt')).split('\f').slice(0, edition.pages);
  if (raw.length !== edition.pages) throw new Error('Page count mismatch for ' + edition.id);
  const pages = raw.map(scanned ? ocrLines : pageLines);
  const order = edition.chapters.flatMap(chapter => chapter.sections);
  const stops = order.map(unit => ({
    page: unit.page,
    line: headingIndex(pages[unit.page - 1] ?? [], unit)
  }));
  const sections = {};
  for (const [index, unit] of order.entries()) {
    const start = stops[index], next = stops[index + 1];
    const end = next ? next.page - (next.line === 0 && next.page > start.page ? 1 : 0) : edition.pages;
    const range = [];
    const reviewed = corrections[edition.id]?.[unit.number] ?? {};
    let checked = 0;
    for (let page = start.page; page <= end; page++) {
      const lines = pages[page - 1] ?? [];
      const begin = page === start.page && index > 0 ? Math.max(0, start.line) : 0;
      const until = next?.page === page && next.line > begin ? next.line : undefined;
      const replacement = reviewed[page];
      const blocks = replacement ?? paragraphs(lines.slice(begin, until), scanned);
      if (replacement) checked++;
      if (blocks.length) range.push([page, blocks]);
    }
    if (!range.length) throw new Error('No extracted text for ' + edition.id + ' ' + unit.number);
    sections[unit.number] = { scanned, reviewed: checked === range.length, pages: range };
  }
  await writeFile(resolve(target, edition.id + '.json'), JSON.stringify({format, edition: edition.sha256, sections}));
  manifest.editions.push(edition.id);
  console.log(edition.id + ' ' + order.length + ' sections from ' + edition.pages + ' pages');
}
await writeFile(resolve(target, 'manifest.json'), JSON.stringify(manifest));

