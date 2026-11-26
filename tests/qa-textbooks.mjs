import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.LMN_BROWSER_EXECUTABLE||undefined,args:['--no-proxy-server']});
const url=process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/';
try {
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.lmnWorkspace);
  assert.equal(await page.locator('#globalSearch').count(),0);
  await page.locator('[data-math-nav=knowledge]').first().click();
  await page.locator('#mathSearch').fill('格林函数');
  const results=page.locator('#textbookMatches');
  await results.locator(':scope > summary').click();
  await results.locator('details > summary').click();
  await results.getByRole('button',{name:/格林函数/}).click();
  const reader=page.locator('#textbookReader');
  assert.match(await reader.locator('.textbook-sections > details[open]').innerText(),/PDF 226/);
  const index=await page.evaluate(async()=>{
    const {TEXTBOOKS}=await import('../../packages/learning/textbooks.js');
    let sections=0,chapters=0,plots=0,formulas=0;
    const routes={algebra:'algebra',ode:'ode',prob:'probability',analysis:'analysis-3',a1:'analysis-3',a2:'analysis-3',a3:'analysis-3'};
    for(const book of TEXTBOOKS){
      window.lmnWorkspace.openMathArchive('course','course-'+routes[book.id]);
      const root=document.querySelector('#textbookReader');
      const [selectBook,selectChapter]=root.querySelectorAll('select');
      selectBook.value=book.id;selectBook.dispatchEvent(new Event('change'));
      for(const chapter of book.chapters){
        selectChapter.value=chapter.number;selectChapter.dispatchEvent(new Event('change'));
        const rows=root.querySelectorAll('.textbook-sections > details');
        if(rows.length!==chapter.sections.length) throw Error(book.id+' '+chapter.number);
        if(root.querySelector('.math-render-error')) throw Error('KaTeX '+book.id+' '+chapter.number);
        sections+=rows.length;chapters++;formulas+=root.querySelectorAll('.katex').length;
        if(chapter.plot) {
          const plot=[...root.querySelectorAll('summary')].find(el=>el.textContent==='用函数图检验').parentElement;
          plot.open=true;
          await new Promise(resolve=>setTimeout(resolve,40));
          if(!plot.querySelector('svg')||!plot.querySelector('.document-plot-controls .katex'))throw Error('figure '+book.id);
          plots++;
        }
      }
    }
    return {sections,chapters,plots,formulas};
  });
  assert.equal(index.sections,245);assert.equal(index.chapters,47);assert.equal(index.plots,5);
  const leaks=await page.evaluate(async()=>{
    const {MATH_KNOWLEDGE,MATH_METHODS,MATH_PROBLEMS}=await import('../../packages/learning/math-content.js');
    const issues=[];
    for(const [view,items] of [['knowledge',MATH_KNOWLEDGE],['method',MATH_METHODS],['problem',MATH_PROBLEMS]]){
      for(const {id} of items){
        lmnWorkspace.openMathArchive(view,id);
        const root=document.querySelector('#mathArchiveContent');
        const text=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        while(text.nextNode()){
          const node=text.currentNode;
          if(node.parentElement.closest('.katex,select,input,textarea,code,svg'))continue;
          if(/\$[^$]+\$/.test(node.textContent)){issues.push(id);break;}
        }
        if(root.querySelector('.math-render-error'))issues.push(id);
      }
    }
    return issues;
  });
  assert.deepEqual(leaks,[]);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await page.locator('.math-main-nav [data-math-nav=courses]').click();
    const strip=page.locator('.document-bar');
    const before=(await strip.boundingBox()).width;
    const add=page.locator('#documentAddSlot button');
    await add.click();
    const firstWidth=(await page.locator('.browser-tab').first().boundingBox()).width;
    for(let i=0;i<12;i++)await add.click();
    const after=await strip.boundingBox(),button=await add.boundingBox();
    assert.ok(Math.abs(before-after.width)<=1,JSON.stringify({width,before,after}));
    assert.ok(button.x+button.width<=after.x+after.width+1);
    assert.ok(button.y>=after.y&&button.y+button.height<=after.y+after.height+1);
    assert.ok((await page.locator('.browser-tab').first().boundingBox()).width<=firstWidth);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(width===1440)assert.ok((await page.locator('.browser-tab').first().boundingBox()).width<firstWidth);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({...index,viewports:[1440,390],errors}));
} finally {await browser.close();}
