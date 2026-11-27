import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/';
const browser=await chromium.launch({executablePath:process.env.LMN_BROWSER_EXECUTABLE,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:950}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(url+'#math/course/course-algebra',{waitUntil:'networkidle'});
  if(process.env.LMN_EXPECTED_SHA){
    const release=await page.request.get(new URL('release.json',url).href,{headers:{'Cache-Control':'no-cache'}});
    assert.equal((await release.json()).commit,process.env.LMN_EXPECTED_SHA);
  }
  const first=page.locator('.course-lesson',{has:page.locator('[data-course-reading=ALG-K01]')});
  const original=first.locator('.course-original-text');
  const paragraph=original.locator('.reading-paragraph').filter({hasText:'顾名思义'}).first();
  await paragraph.waitFor();
  assert.ok((await paragraph.innerText()).includes('抽象的层面上研究代数结构'));
  assert.ok(await original.locator('.katex').count()>10);
  assert.equal(await original.locator('.katex-error').count(),0);
  assert.equal(await first.locator('[data-math-archive-action=book]').isVisible(),false);
  assert.equal(await page.getByRole('button',{name:'连接教材'}).isVisible(),false);
  assert.equal(await first.locator('canvas,iframe,pre, input[type=file]').count(),0);
  assert.equal(await first.locator('.course-reading-companion').evaluate(node=>node.open),false);
  await paragraph.evaluate(container=>{
    const block=container.querySelector('p');
    const text=block.firstChild;
    const range=document.createRange();
    range.setStart(text,0);
    range.setEnd(text,4);
    const selection=window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    block.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
  });
  await paragraph.getByRole('button',{name:/段批注/}).click();
  await paragraph.getByRole('textbox',{name:'段落批注'}).fill(String.raw`按原文检查 $S\times S\to S$`);
  await paragraph.getByRole('button',{name:'分屏',exact:true}).click();
  await page.waitForFunction(()=>lmnWorkspace.mathArchive.timers.size===0);
  await page.reload({waitUntil:'networkidle'});
  await paragraph.waitFor();
  await paragraph.getByRole('button',{name:/段批注/}).click();
  await paragraph.locator('.reading-note-panel .katex').waitFor();
  await mkdir('qa-output',{recursive:true});
  await page.screenshot({path:'qa-output/course-original-desktop.png'});
  await page.setViewportSize({width:390,height:850});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'qa-output/course-original-mobile.png'});
  const inventory=await page.evaluate(async()=>{
    const {MATH_COURSES,mathKnowledgeById}=await import('../../packages/learning/math-content.js');
    const {TEXTBOOK_EDITIONS}=await import('../../packages/learning/textbook-editions.js');
    const {loadCourseTextEdition}=await import('../../packages/ui/course-original.js');
    const available=await Promise.all(TEXTBOOK_EDITIONS.map(async edition=>[edition.title,await loadCourseTextEdition(edition)]));
    const lookup=Object.fromEntries(available);
    const missing=[];
    const groups=MATH_COURSES.flatMap(course=>course.chapters.flatMap(chapter=>chapter.groups));
    for(const {id} of groups){
      const {source}=mathKnowledgeById(id);
      if(!lookup[source?.book]?.[source?.section]?.pages?.length)missing.push(id);
    }
    return {courses:MATH_COURSES.length,sections:groups.length,missing};
  });
  assert.deepEqual(inventory.missing,[]);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.context().setOffline(true);
  await page.reload();
  await paragraph.waitFor();
  assert.ok(await paragraph.locator('.katex').count());
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({inventory,htmlProse:true,notesRestored:true,math:true,mobile:true}));
}finally{await browser.close();}

