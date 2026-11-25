import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
try{
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(async()=>{
    const cache=await caches.open((await caches.keys()).find(key=>key.startsWith('lmn-v')));
    const root=new URL('./',location.href),html=await (await fetch(root)).text();
    await cache.put(root,new Response(html.replace('</head>','<meta name="lmn-cache-probe" content="stale"></head>'),{headers:{'Content-Type':'text/html'}}));
    await cache.put(new URL('math-site.css',root),new Response(':root{--cache-probe:stale}',{headers:{'Content-Type':'text/css'}}));
    const {put}=await import(new URL('db.js',root));await put('settings',{id:'qa-cache-preserve',value:'keep my learning data'});
  });
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  assert.equal(await page.locator('meta[name="lmn-cache-probe"]').count(),0,'Online reload must replace stale cached HTML');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cache-probe')),'','Online reload must replace stale CSS');
  assert.equal(await page.locator('.math-main-nav button').count(),8);
  // A completed response must also persist into the offline fallback cache.
  await page.waitForFunction(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.startsWith('lmn-v')));return !(await(await c.match(new URL('./',location.href))).text()).includes('lmn-cache-probe')});
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  assert.equal(await page.locator('meta[name="lmn-cache-probe"]').count(),0);
  assert.equal(await page.locator('.math-main-nav button').count(),8);
  const saved=await page.evaluate(async()=>{const {get}=await import(new URL('db.js',location.href));return get('settings','qa-cache-preserve')});
  assert.equal(saved.value,'keep my learning data');
  console.log('PASS: stale HTML/CSS refreshed online; new UI works offline; IndexedDB preserved');
  await context.close();
}finally{await browser.close()}
