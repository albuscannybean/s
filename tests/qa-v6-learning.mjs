import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/';
const browser=await chromium.launch({headless:true,executablePath:process.env.LMN_BROWSER_EXECUTABLE||undefined,args:['--no-proxy-server']});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await mkdir('qa-output',{recursive:true});
try{
  await page.goto(base,{waitUntil:'networkidle'});
  if(process.env.LMN_EXPECTED_SHA){
    const response=await page.request.get(new URL('release.json',base).href);
    assert.equal((await response.json()).commit,process.env.LMN_EXPECTED_SHA);
  }
  await page.waitForFunction(()=>!!window.lmnWorkspace);
  await page.locator('.course-tile[data-id=course-algebra]').click();
  await page.locator('[data-course-reading=ALG-K01] .course-original-prose').waitFor();
  assert.equal(await page.locator('.reading-panel-left').evaluate(panel=>panel.open),true);
  assert.match(await page.locator('[data-course-reading=ALG-K01] .course-original-source').textContent(),/已确认公开转载授权/);
  await page.screenshot({path:'qa-output/v6-desktop.png'});
  await page.getByRole('button',{name:'下一节',exact:true}).click();
  await page.locator('[data-course-reading=ALG-K04] .course-original-prose').waitFor();
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.lmnWorkspace);
  assert.equal(await page.locator('.reading-panel-left select').last().inputValue(),'ALG-K04');

  await page.locator('#mathSearchEntry').click();
  assert.equal(await page.locator(':focus').getAttribute('id'),'mathSearch');
  await page.locator('#mathSearch').fill('生成元与陪集');
  await page.locator('#mathArchiveResults [data-id=LAB-CYCLIC]').click();
  await page.locator('[name=g]').fill('3');
  assert.match(await page.locator('.experiment-results').innerText(),/阶 8 · 陪集数 1/);
  await page.locator('.experiment-note textarea').fill('当步长与模数互素时，可以生成整个群。');
  await page.waitForFunction(()=>lmnWorkspace.mathArchive.timers.size===0);
  await page.screenshot({path:'qa-output/v6-experiment.png'});
  await page.locator('[data-lab-ref=problem]').click();
  await page.locator('[data-math-archive-action=start]').click();
  await page.locator('.study-optional-reference summary').click();
  await page.locator('.study-optional-reference .katex').first().waitFor();
  await page.locator('#studyDraft').fill('用最小的正周期计算元素的阶。');
  await page.locator('[data-study-action=submit]').click();
  await page.locator('.math-main-nav [data-math-nav=sessions]').click();
  assert.match(await page.locator('#mathRecentReading').innerText(),/近世代数/);
  await page.evaluate(async()=>{
    const {savePageNote}=await import('../../packages/ui/textbook-shelf.js');
    const {TEXTBOOK_EDITIONS}=await import('../../packages/learning/textbook-editions.js');
    await savePageNote({id:'test-page-note',edition:TEXTBOOK_EDITIONS[0].sha256,page:19,
      quote:'子群',body:'核对定理中的非空性。',rects:[[0.2,0.5,0.1,0.04]],createdAt:new Date().toISOString()});
  });
  await page.locator('#mathLearningBackup summary').click();
  const running=page.waitForEvent('download');
  await page.locator('[data-backup-export]').click();
  const download=await running;
  const stream=await download.createReadStream(),bytes=[];
  for await(const chunk of stream)bytes.push(chunk);
  const backup=Buffer.concat(bytes),data=JSON.parse(backup.toString('utf8'));
  assert.equal(data.study.sessions[0].attempts.length,1);
  assert.ok(data.annotations.some(item=>item.subjectId==='LAB-CYCLIC'));
  assert.ok(data.pageNotes.some(item=>item.id==='test-page-note'));
  assert.equal(data.progress['course-algebra'].unitId,'ALG-K04');
  await page.evaluate(async()=>{
    const {deletePageNote}=await import('../../packages/ui/textbook-shelf.js');
    await deletePageNote('test-page-note');
  });
  await page.locator('#mathLearningBackup input').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backup});
  await page.locator('[data-backup-restore]').click();
  await page.locator('#mathLearningBackup [role=status]').getByText(/已合并/).waitFor();
  assert.equal(await page.evaluate(async()=>{
    const {allPageNotes}=await import('../../packages/ui/textbook-shelf.js');
    return (await allPageNotes()).some(note=>note.id==='test-page-note');
  }),true);

  await page.evaluate(()=>lmnWorkspace.openMathArchive('discovery','LAB-BERNOULLI'));
  await page.locator('[name=p]').fill('0');
  assert.match(await page.locator('.experiment-results').innerText(),/条件概率 未定义/);
  await page.locator('[name=p]').fill('0.5');
  assert.match(await page.locator('.experiment-results').innerText(),/0.6667/);
  await page.evaluate(()=>lmnWorkspace.openMathArchive('discovery','LAB-LOGISTIC'));
  const curve=page.locator('.experiment-results svg path').last();
  const trajectory=await curve.getAttribute('d');
  await page.locator('[name=y]').fill('1.4');
  assert.notEqual(await curve.getAttribute('d'),trajectory);

  const checked=[];
  for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(value=>{lmnWorkspace.preferences.theme=value;lmnWorkspace.applyPreferences()},theme);
    const pages=[['courses',''],['course','course-algebra'],['knowledge','ALG-K01'],['method','ALG-M01'],['problem','ALG-P02'],['discovery','LAB-LOGISTIC']];
    for(const [view,id] of pages){
      await page.evaluate(([view,id])=>lmnWorkspace.openMathArchive(view,id),[view,id]);
      const bounds=await page.evaluate(()=>{
        const root=document.querySelector('#mathArchive');
        return [innerWidth,document.documentElement.scrollWidth,root.clientWidth,root.scrollWidth];
      });
      assert.ok(bounds[1]<=bounds[0]+1&&bounds[3]<=bounds[2]+1,`${theme}/${width}/${view} overflow ${bounds}`);
    }
    checked.push([theme,width]);
    if(width===390||width===1440){
      await page.evaluate(()=>lmnWorkspace.openMathArchive('course','course-algebra'));
      await page.locator('.course-original-prose').first().waitFor();
      await page.screenshot({path:`qa-output/v6-${theme}-${width}.png`});
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile('qa-output/v6-learning.json',JSON.stringify({checked,errors,courseResume:true,backup:true,search:true,inlineMath:true},null,2));
  console.log('V6 learning, backup, source authorization, experiments and responsive readings passed');
}finally{await browser.close();}

