import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await mkdir('qa-output',{recursive:true});
const result={};
const shot=name=>page.screenshot({path:`qa-output/design-${name}.png`,animations:'disabled'});
try {
  await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('class'),'skip-link');
  await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'workspace');
  await page.locator('#navigator-tab-outline').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#navigator-tab-library').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#navigatorPanel').getAttribute('aria-labelledby'),'navigator-tab-library');
  await page.keyboard.press('Home');assert.equal(await page.locator('#navigator-tab-outline').getAttribute('aria-selected'),'true');
  await page.locator('#navigatorResizer').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#navigatorResizer').getAttribute('aria-valuenow'),'320');
  await page.keyboard.press('ArrowLeft');
  await page.locator('#moreBtn').click();
  assert.ok(await page.locator('#contextMenu').evaluate(e=>e.contains(document.activeElement)));
  await page.keyboard.press('End');assert.ok(await page.locator('#contextMenu button:not(:disabled)').last().evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Escape');assert.equal(await page.locator(':focus').getAttribute('id'),'moreBtn');
  await shot('home');
  result.themes=[];
  for(const theme of ['warm','paper','violet','slate','dark']){
    await page.evaluate(theme=>{lmnWorkspace.preferences.theme=theme;lmnWorkspace.applyPreferences()},theme);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const appearance=await page.locator('.content-root-target').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
    result.themes.push({theme,...appearance});
    if(theme==='dark')assert.notEqual(appearance.background,'rgb(255, 255, 255)');
  }
  await shot('dark');
  await page.locator('[data-welcome="import"]').click();
  const label=await page.locator('#importDialog').getAttribute('aria-labelledby');assert.ok(label);
  assert.ok(await page.locator(`#${label}`).isVisible());
  await page.keyboard.press('Escape');assert.equal(await page.locator('#importDialog').getAttribute('open'),null);
  await page.evaluate(async()=>{
    const {createKnowledge}=await import('../../packages/domain/core.js');
    const {createStructureInstance}=await import('../../packages/structure-engine/model.js');
    const app=lmnWorkspace,k=createKnowledge('设计验收 · 知识结构与正文');app.state.knowledge.push(k);
    const template=app.state.structureTemplates.find(t=>t.id==='builtin:n-center');
    const instance=createStructureInstance(template,k.id);app.state.structureInstances.push(instance);app.openInstance(instance.id);
  });
  await page.locator('#structureSettingsButton').click();
  assert.equal(await page.locator(':focus').getAttribute('id'),'closePanel');
  await page.waitForFunction(()=>document.querySelector('#workspace').getBoundingClientRect().right<=document.querySelector('#floatingPanel').getBoundingClientRect().left+1);
  result.panel=await page.evaluate(()=>({workspace:document.querySelector('#workspace').getBoundingClientRect().toJSON(),inspector:document.querySelector('#floatingPanel').getBoundingClientRect().toJSON()}));
  assert.ok(result.panel.workspace.right<=result.panel.inspector.left+1,'Docked inspector must not cover workspace');
  await shot('workspace');
  await page.locator('#closePanel').click();assert.equal(await page.locator(':focus').getAttribute('id'),'structureSettingsButton');
  await page.evaluate(()=>{lmnWorkspace.preferences.theme='warm';lmnWorkspace.applyPreferences();lmnWorkspace.activateHome()});
  result.viewports=[];
  for(const width of [1024,768,390]){
    await page.setViewportSize({width,height:844});
    await page.waitForFunction(width=>document.documentElement.clientWidth===width,width);
    if(width<=900)await page.waitForFunction(()=>document.querySelector('#navigator').inert&&document.querySelector('#workspace').getBoundingClientRect().x===0);
    const bounds=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth,workspace:document.querySelector('#workspace').getBoundingClientRect().toJSON()}));
    assert.ok(bounds.page<=width+1,'Page must not overflow horizontally');
    if(width<=900)assert.equal(bounds.workspace.x,0);
    assert.ok(await page.locator('#globalSearch').isVisible(),'Command entry remains reachable');
    for(const action of ['knowledge','library','import']){
      const box=await page.locator(`[data-welcome="${action}"]`).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
    }
    result.viewports.push({width,...bounds});await shot(`width-${width}`);
  }
  await page.locator('#toggleNavigator').click();assert.equal(await page.locator('#navigator').evaluate(e=>e.inert),false);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#navigator')).visibility==='visible');
  await page.locator('#navigatorFilter').click();assert.equal(await page.locator(':focus').getAttribute('id'),'navigatorFilter');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#navigator').evaluate(e=>e.inert),true);
  assert.equal(await page.locator(':focus').getAttribute('id'),'toggleNavigator');
  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>!document.querySelector('#navigator').inert);
  await page.evaluate(()=>{lmnWorkspace.preferences.language='en';lmnWorkspace.renderAll()});
  assert.equal(await page.locator('.welcome h1').textContent(),'Knowledge workspace');
  result.errors=errors;assert.deepEqual(errors,[]);
  await writeFile('qa-output/design-system.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close()}
