import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {checkReadingMode} from './reading-mode-qa.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.LMN_BROWSER_EXECUTABLE||undefined,args:['--no-proxy-server']});
const url=process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/';
try {
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(url,{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  if(process.env.LMN_EXPECTED_SHA){
    const release=await page.request.get(new URL('release.json',url).href,{headers:{'Cache-Control':'no-cache'}});
    assert.equal((await release.json()).commit,process.env.LMN_EXPECTED_SHA);
  }
  await page.waitForFunction(()=>!!window.lmnWorkspace);
  const nav=kind=>page.locator('.math-main-nav [data-math-nav='+kind+']');
  assert.equal(await page.locator('#globalSearch').count(),0);
  const strip=page.locator('.document-bar');
  const initial=(await strip.boundingBox()).width;
  const add=page.locator('#documentAddSlot button');
  await add.click();
  const first=page.locator('.browser-tab').first(),tabWidth=(await first.boundingBox()).width;
  for(let i=0;i<12;i++)await add.click();
  assert.ok(Math.abs((await strip.boundingBox()).width-initial)<=1);
  assert.ok((await first.boundingBox()).width<tabWidth);
  await checkReadingMode(page);

  await nav('knowledge').click();
  await page.locator('[data-catalog-filter=course]').selectOption('course-analysis-3');
  await page.locator('[data-catalog-filter=chapter]').selectOption('course-a3-10');
  await page.locator('#mathSearch').fill('勒贝格空间');
  await page.locator('#mathArchiveResults [data-id="MATH-A3-K10-4"]').click();
  assert.equal(await page.getByRole('heading',{name:'勒贝格空间',exact:true}).count(),1);
  assert.ok(await page.locator('#mathReadingBody .katex').count()>0);
  await page.locator('[data-math-archive-action=chapter]').click();
  assert.ok(await page.locator('#course-a3-10').evaluate(el=>el.open));
  assert.equal(await page.locator('#textbookReader,#textbookMatches').count(),0);
  assert.equal(await page.locator('#courseBook input[accept*="pdf"]').count(),0);
  await page.locator('#course-a3-10 .course-original-prose').first().waitFor();
  const changeOfVariables=page.locator('#course-a3-10 .course-lesson')
    .filter({has:page.locator('[data-course-reading="MATH-A3-K10-8"]')});
  await changeOfVariables.getByText(/本节练习/).click();
  await page.getByRole('button',{name:/正定二次型的高斯积分/}).click();
  assert.match(await page.locator('.course-source').innerText(),/习题 8.1/);
  assert.ok(await page.locator('#mathReadingBody .katex').count()>0);
  await page.locator('[data-math-archive-action=start]').click();
  assert.ok(await page.locator('#studyQuestion .katex').count()>0);
  await page.locator('#studyDraft').fill('先正交对角化，再按特征值缩放。');
  await page.locator('[data-study-action=submit]').click();
  await page.locator('[data-study-action=hint]').click();
  assert.ok(await page.locator('#studyHints .study-hint').count());

  const inventory=await page.evaluate(async()=>{
    const {MATH_COURSES,MATH_KNOWLEDGE,MATH_PROBLEMS,MATH_METHODS}=await import('../../packages/learning/math-content.js');
    for(const course of MATH_COURSES){
      lmnWorkspace.openMathArchive('course',course.id);
      if(document.querySelectorAll('.math-chapter-card').length!==course.chapters.length)throw Error(course.id);
      if(document.querySelectorAll('.course-lesson').length!==course.chapters.reduce((n,c)=>n+c.groups.length,0))throw Error('Missing sections in '+course.id);
    }
    for(const [view,items] of [['knowledge',MATH_KNOWLEDGE],['method',MATH_METHODS],['problem',MATH_PROBLEMS]]){
      for(const {id} of items){
        lmnWorkspace.openMathArchive(view,id);
        const root=document.querySelector('#mathArchiveContent');
        const reader=root.querySelector('#mathReadingBody,#mathMethodAction');
        if(!reader?.textContent.trim())throw Error('Missing reading '+id);
        const text=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        while(text.nextNode()){
          const node=text.currentNode;
          if(node.parentElement.closest('.katex,select,input,textarea,code,svg'))continue;
          if(/\$[^$]+\$/.test(node.textContent))throw Error('Unrendered formula in '+id+' '+node.textContent.slice(0,80));
        }
        if(root.querySelector('.math-render-error,.document-plot-error'))throw Error('Render error '+id);
      }
    }
    return [MATH_COURSES.length,MATH_KNOWLEDGE.length,MATH_PROBLEMS.length,MATH_METHODS.length];
  });
  assert.deepEqual(inventory,[6,255,356,58]);

  await page.setViewportSize({width:390,height:844});
  await nav('courses').click();
  await page.locator('[data-archive-kind=course][data-id=course-ode]').click();
  await page.locator('#courseChapterJump').selectOption('course-ode-2');
  await page.locator('#course-ode-2 [data-id=ODE-K01]').click();
  await page.locator('.document-plot svg').first().waitFor({state:'attached'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({inventory,errors}));
}finally{await browser.close()}
