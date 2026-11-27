import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  headless: true, executablePath: process.env.LMN_BROWSER_EXECUTABLE || undefined, args: ['--no-proxy-server']
});
const url = process.env.LMN_QA_URL || 'http://127.0.0.1:4174/apps/web/';
const bundle = process.env.LMN_TEXTBOOK_BUNDLE;

function fixture() {
  const contents = text => {
    const value = 'BT /F1 18 Tf 32 340 Td (' + text + ') Tj ET';
    return '<< /Length ' + value.length + ' >>\nstream\n' + value + '\nendstream';
  };
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    ...[6, 7].map(i => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents ' + i + ' 0 R >>'),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', contents('Definitions and examples'), contents('The next page')
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((item, i) => {
    const offset = body.length;
    body += (i + 1) + ' 0 obj\n' + item + '\nendobj\n';
    return offset;
  });
  const xref = body.length;
  body += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (const offset of offsets) body += String(offset).padStart(10, '0') + ' 00000 n \n';
  body += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(body, 'ascii');
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (process.env.LMN_EXPECTED_SHA) {
    const release = await page.request.get(new URL('release.json', url).href, { headers: { 'Cache-Control': 'no-cache' } });
    assert.equal((await release.json()).commit, process.env.LMN_EXPECTED_SHA);
  }
  await page.waitForFunction(() => !!globalThis.lmnWorkspace);
  await page.locator('#documentAddSlot button').click();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    const tab = await page.locator('.document-bar').boundingBox();
    const content = await page.locator('.new-tab-content').boundingBox();
    assert.ok(Math.abs(tab.x - content.x) <= 1, 'new tab and tab bar use the same inset');
    assert.ok(content.x > 0 && content.x + content.width < width);
  }
  await page.locator('.math-main-nav [data-math-nav="courses"]').click();
  await page.locator('[data-archive-kind="course"][data-id="course-algebra"]').click();
  const reader = page.locator('#courseBook');
  const fixturePDF = bundle ? null : fixture();
  await page.waitForFunction(()=>document.querySelector('[data-course-reading=ALG-K01] .course-original-prose'));
  await page.evaluate(async hash => {
    lmnWorkspace.mathArchive.leaveCourse();
    const { mountTextbookReader } = await import('../../packages/ui/textbook-reader.js');
    const host=document.querySelector('#courseBook');
    host.closest('section').hidden=false;
    lmnWorkspace.mathArchive.bookReader = mountTextbookReader(host, hash ? {
      books: [{ id: 'qa-book', title: 'QA book', sha256: hash, pages: 2, chapters: [] }]
    } : { bookId: 'algebra' });
  }, fixturePDF ? createHash('sha256').update(fixturePDF).digest('hex') : null);
  const attach = reader.locator('[data-files]');
  await attach.setInputFiles(bundle || { name: 'fixture.pdf', mimeType: 'application/pdf', buffer: fixturePDF });
  const text = reader.locator('.textLayer span').filter({ hasText: bundle ? /半群|群/ : 'Definitions and examples' }).first();
  await text.waitFor();
  await page.waitForFunction(() => !document.querySelector('.book-paper').hasAttribute('aria-busy'));
  assert.equal(await reader.locator('[data-page]').inputValue(), bundle ? '11' : '1');
  assert.ok(await reader.locator('canvas').isVisible());
  assert.ok(await text.evaluate(node => node.getBoundingClientRect().width > 20));
  await text.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await reader.locator('.book-selection').click();
  const dialog = reader.locator('dialog');
  assert.ok((await dialog.locator('blockquote').innerText()).length > 0);
  await dialog.getByRole('textbox', { name: '批注文字' }).fill('对照原文后，记下 $x^2$。');
  await dialog.getByRole('button', { name: '保存批注' }).click();
  await reader.locator('.book-note-list .katex').waitFor();
  assert.ok(await reader.locator('.book-highlights span').count());
  await reader.locator('[data-next]').click();
  await page.waitForFunction(() => !document.querySelector('.book-paper').hasAttribute('aria-busy'));
  assert.equal(await reader.locator('[data-page]').inputValue(), bundle ? '12' : '2');
  assert.equal(await reader.locator('.book-highlights span').count(), 0);
  await reader.locator('[data-prev]').click();
  await reader.locator('.book-highlights span').first().waitFor();
  await reader.locator('[data-zoom]').selectOption('1.25');
  await reader.locator('.book-highlights span').first().waitFor();
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (bundle) {
    await mkdir('qa-output', { recursive: true });
    await page.screenshot({ path: 'qa-output/private-textbook-mobile.png' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('已连接的原页与旧批注',{exact:true}).click();
    await reader.locator('.book-highlights span').first().waitFor();
    for (const [course, edition, pages] of [
      ['course-ode', 'ode', '264'], ['course-probability', 'prob', '478'],
      ['course-analysis-3', 'analysis', '358'], ['course-analysis-1', 'a1', '352'],
      ['course-analysis-1', 'a2', '360'], ['course-analysis-1', 'a3', '422']
    ]) {
      await page.locator('.math-main-nav [data-math-nav="courses"]').click();
      await page.locator('[data-archive-kind="course"][data-id="' + course + '"]').click();
      await page.getByText('已连接的原页与旧批注',{exact:true}).click();
      await reader.locator('[data-book]').selectOption(edition);
      await reader.locator('.textLayer').waitFor();
      await page.waitForFunction(() => !document.querySelector('.book-paper').hasAttribute('aria-busy'));
      assert.equal(await reader.locator('[data-total]').innerText(), '/ ' + pages);
      assert.ok(await reader.locator('canvas').isVisible());
    }
  }
  assert.deepEqual(errors, []);
  console.log('Textbook page, selectable text, anchored LaTeX annotation, zoom, page turns and new-tab margins passed.');
} finally {
  await browser.close();
}

