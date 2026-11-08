import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const url=process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/';
const errors=[],result={url};
await mkdir('qa-output',{recursive:true});
try{
  // Every context is ephemeral. Upgrade a populated v7 database without starting the app.
  const upgrade=await browser.newContext({serviceWorkers:'block'}),probe=await upgrade.newPage();
  await probe.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Database upgrade probe</title>'}));
  await probe.goto(url);
  result.upgrade=await probe.evaluate(async()=>{
    const stores=['knowledge','relations','representations','structureTemplates','structureInstances','variableSchemes','knowledgePackages','contentObjects','structureViews','boards','placements','settings','migrationState','lmns','structures'];
    const old=await new Promise((resolve,reject)=>{const r=indexedDB.open('lmn-knowledge-system',7);r.onupgradeneeded=()=>stores.forEach(name=>r.result.createObjectStore(name,{keyPath:'id'}));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const sentinel=name=>({id:`preserve:${name}`,body:'旧数学正文 $\\forall x$',nested:{values:[1,2,3]}});
    await new Promise((resolve,reject)=>{const tx=old.transaction(stores,'readwrite');stores.forEach(name=>tx.objectStore(name).put(sentinel(name)));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});old.close();
    const db=await import(new URL('db.js',location.href));
    const current=await db.openDatabase();
    const preserved=await Promise.all(stores.map(async name=>JSON.stringify(await db.get(name,`preserve:${name}`))===JSON.stringify(sentinel(name))));
    return{version:current.version,stores:stores.length,preserved:preserved.every(Boolean),newStoreEmpty:(await db.list('studySessions')).length===0};
  });
  assert.deepEqual(result.upgrade,{version:9,stores:15,preserved:true,newStoreEmpty:true});await upgrade.close();

  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  assert.equal((await page.goto(url,{waitUntil:'networkidle'})).status(),200);
  await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  // Cache installation must include the actual lesson modules and theme resources.
  result.cached=await page.evaluate(async()=>{const keys=await caches.keys(),cache=await caches.open(keys.find(key=>key.startsWith('lmn-v')));return(await cache.keys()).map(request=>new URL(request.url).pathname)});
  for(const suffix of ['/math-site.css','/study-session.js','/study-workbench.js','/math-content.js','/math-archive.js'])assert.ok(result.cached.some(path=>path.endsWith(suffix)));
  result.cached=result.cached.length;
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:950});
    await page.waitForFunction(width=>document.documentElement.clientWidth===width,width);
    assert.ok(await page.locator('.math-brand-copy b').isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`page overflow at ${width}`);
    const bounds=await page.locator('#globalSearch').boundingBox();assert.ok(bounds.x+bounds.width<=width+1);
  }
  await page.locator('[data-math-nav="sessions"]').click();
  assert.equal(await page.locator('[data-math-nav="sessions"]').getAttribute('aria-current'),'page');
  await page.locator('[data-math-nav="courses"]').click();
  await page.locator('[data-archive-kind="course"]').waitFor({state:'visible'});
  await page.locator('#mathToolboxToggle').click();await page.locator('[data-math-tool="structure"]').click();await page.locator('#structureLibrary').waitFor({state:'visible'});await page.keyboard.press('Escape');
  await page.locator('#globalSearch').click();await page.locator('#mathSearch').waitFor({state:'visible'});
  await page.locator('#mathToolboxToggle').click();await page.locator('[data-math-tool="import"]').click();await page.locator('#importDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
  await page.locator('[data-math-nav="home"]').click();
  await page.screenshot({path:'qa-output/math-release-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'qa-output/math-release-mobile.png'});
  await page.locator('[data-math-action="example"]').click();
  await page.locator('[data-math-archive-action="start"]').click();
  await page.locator('#studyWorkbench').waitFor({state:'visible'});
  assert.ok(await page.locator('#studyQuestion .katex').count()>0);
  await page.locator('#studyDraft').fill('离线保留的独立尝试：N 不应依赖 x。');
  await page.locator('[data-study-action="submit"]').click();
  await page.evaluate(()=>lmnWorkspace.studyWorkbench.saving);
  result.knowledge=await page.evaluate(()=>lmnWorkspace.state.knowledge.length);assert.equal(result.knowledge,0);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  await page.locator('#studySessionsHome .learning-recent-row').click();
  assert.match(await page.locator('.study-records').textContent(),/离线保留的独立尝试/);
  await page.locator('[data-study-action="hint"]').click();assert.match(await page.locator('#studyHints').textContent(),/固定/);
  await page.screenshot({path:'qa-output/math-release-offline-study.png'});
  await page.locator('[data-study-action="knowledge"][data-value="ANA-UC-K02"]').click();
  assert.ok(await page.locator('#mathReadingBody .katex').count()>0);result.offlineContent=true;
  assert.deepEqual(errors,[]);result.offlineStudy=true;result.errors=errors;
  await writeFile('qa-output/math-release.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));await context.close();
}finally{await browser.close()}
