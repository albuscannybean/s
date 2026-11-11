import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[],result={};
page.on('pageerror',error=>errors.push(error.message));await mkdir('qa-output',{recursive:true});
try{
  await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  assert.deepEqual(await page.locator('.math-main-nav button').allTextContents(),['首页','发现','课程','题库','知识','方法','记录','应用数学']);
  result.chrome=await page.evaluate(()=>{const nav=document.querySelector('.math-main-nav'),card=nav.querySelector('button');return{background:getComputedStyle(document.querySelector('#welcome')).backgroundColor,ink:getComputedStyle(document.querySelector('#welcome')).color,brand:getComputedStyle(document.querySelector('.math-brand-symbol')).backgroundColor,masthead:document.querySelector('.math-masthead').getBoundingClientRect().height,gap:getComputedStyle(nav).gap,radius:getComputedStyle(card).borderRadius,tabsTop:document.querySelector('.document-bar').getBoundingClientRect().top,navBottom:nav.getBoundingClientRect().bottom,workspaceX:document.querySelector('#workspace').getBoundingClientRect().x}});
  // Values measured from the reference Yi website's light/indigo shell.
  assert.equal(result.chrome.background,'rgb(238, 236, 231)');assert.equal(result.chrome.brand,'rgb(53, 59, 112)');assert.equal(result.chrome.masthead,94);assert.equal(result.chrome.gap,'8px');assert.equal(result.chrome.radius,'10px');assert.equal(result.chrome.workspaceX,0);assert.equal(result.chrome.tabsTop,result.chrome.navBottom);
  assert.equal(await page.locator('#navigator').isVisible(),false);
  await page.locator('.math-main-nav [data-math-nav="courses"]').click();await page.locator('[data-archive-kind="course"]').click();
  await page.locator('#mathArchive [data-id="ANA-UC-K02"]').click();
  assert.ok(await page.locator('#documentTabs [data-tab-key]').count()>=2,'Public course and knowledge receive real document tabs');
  await page.locator('#mathPrivateNote').fill('UI 重整保留的私人批注');await page.waitForFunction(()=>lmnWorkspace.mathArchive.timers.size===0);
  const knowledgeTab=await page.evaluate(()=>lmnWorkspace.activeTabKey);
  await page.locator('[data-platform-module="applied"]').click();await page.locator('#appliedHome').waitFor({state:'visible'});
  await page.locator('#appliedHome [data-template="builtin:matrix-grid"]').click();await page.locator('#confirmStructureInsert').click();
  await page.waitForFunction(()=>lmnWorkspace.instance?.templateId==='builtin:matrix-grid');
  const structureId=await page.evaluate(()=>lmnWorkspace.instance.id);assert.equal(await page.locator('#navigator').isVisible(),false);
  await page.locator('#mathToolboxToggle').click();await page.locator('#toggleNavigator').click();
  assert.equal(await page.locator('#contentLibraryDialog').evaluate(e=>e.open),true);assert.equal(await page.locator('#navigator').evaluate(e=>e.inert),false);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#navigator').isVisible(),false);
  await page.locator('#mathToolboxToggle').click();await page.locator('[data-platform-action="export"]').click();await page.locator('#exportDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
  await page.locator(`[data-tab-key="${knowledgeTab}"]`).click();assert.equal(await page.locator('#mathPrivateNote').inputValue(),'UI 重整保留的私人批注');
  assert.equal(await page.locator('.math-main-nav [data-math-nav="knowledge"]').getAttribute('aria-current'),'page');
  await page.locator('.math-brand').click();await page.screenshot({path:'qa-output/platform-theory.png'});
  await page.locator('[data-platform-module="applied"]').click();await page.screenshot({path:'qa-output/platform-applied.png'});
  result.viewports=[];
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await page.waitForFunction(()=>document.querySelector('.document-bar').getBoundingClientRect().top===document.querySelector('.math-main-nav').getBoundingClientRect().bottom);assert.ok(await page.locator('.math-brand-copy b').isVisible());const bounds=await page.evaluate(()=>({width:innerWidth,page:document.documentElement.scrollWidth,workspace:document.querySelector('#workspace').getBoundingClientRect().x,tabs:document.querySelector('.document-bar').getBoundingClientRect().top,nav:document.querySelector('.math-main-nav').getBoundingClientRect().bottom}));assert.ok(bounds.page<=width+1);assert.equal(bounds.workspace,0);assert.equal(bounds.tabs,bounds.nav);result.viewports.push(bounds);if(width===390)await page.screenshot({path:'qa-output/platform-mobile.png'})}
  await page.evaluate(id=>lmnWorkspace.openInstance(id),structureId);assert.equal(await page.locator('#navigator').isVisible(),false);
  assert.deepEqual(errors,[]);result.errors=errors;result.publicTabs=true;result.privateAnnotations=true;result.matrixTool=true;result.noLeftSidebar=true;
  await writeFile('qa-output/platform-ui.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
