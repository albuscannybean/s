import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({
  headless:true,
  ...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{}),
  ...(process.env.LMN_QA_URL?.startsWith('https:')?{args:['--no-proxy-server']}:{})
});
const base=new URL(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/');
const legacy='lmn-v5.1.4-web-111111111111';
const neighbor='lmn-v5.1.4-web-222222222222';
const navLabels=['课程','知识库','方法库','题库','实验'];

try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));

  // Create an old install's caches and valid private records before the new worker starts.
  const seed=new URL('cache-upgrade-seed',base).href;
  await page.route(seed,route=>route.fulfill({contentType:'text/html',body:'<title>Cache migration fixture</title>'}));
  await page.goto(seed);
  await page.evaluate(async ({root,legacy,neighbor})=>{
    await (await caches.open(legacy)).put(root,new Response('old offline HTML'));
    await (await caches.open(neighbor)).put(new URL('/unrelated/apps/web/',root),new Response('neighbor app'));
    const {put}=await import(new URL('db.js',root));
    const {createStudySession,submitStudyAttempt,updateStudyDraft}=await import(new URL('../../packages/learning/study-session.js',root));
    const session=createStudySession({id:'qa-cache-session',title:'缓存升级前的学习会话',mode:'problem',problemId:'PROB-P01'});
    await put('studySessions',submitStudyAttempt(updateStudyDraft(session,'先写下四种有序结果。')));
    await put('settings',{id:'qa-cache-preserve',value:'keep my learning data'});
    await put('mathAnnotations',{id:'math-note:PROB-K01',subjectId:'PROB-K01',body:'保留个人批注',mastery:'初步理解',updatedAt:new Date().toISOString()});
    localStorage.setItem('lmn:math-library:folders',JSON.stringify([{name:'期中复习',items:['PROB-K01']}]));
  },{root:base.href,legacy,neighbor});

  await page.goto(base.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!globalThis.lmnWorkspace&&!!navigator.serviceWorker.controller);
  const cacheName=await page.evaluate(async()=>{
    const {scope}=await navigator.serviceWorker.ready;
    return (await caches.keys()).find(key=>key.startsWith('lmn-web:'+scope+':'));
  });
  assert.ok(cacheName,'Worker precaches into its own scope');
  const keys=await page.evaluate(()=>caches.keys());
  assert.ok(!keys.includes(legacy),'Superseded math-site cache is removed');
  assert.ok(keys.includes(neighbor),'Legacy cache belonging to another application is preserved');
  await page.evaluate(async ({cacheName,root})=>{
    const cache=await caches.open(cacheName);
    const html=await(await cache.match(root)).text();
    await cache.put(root,new Response(html.replace('</head>','<meta name="lmn-cache-probe" content="stale"></head>'),{headers:{'Content-Type':'text/html'}}));
    await cache.put(new URL('math-site.css',root),new Response(':root{--cache-probe:stale}',{headers:{'Content-Type':'text/css'}}));
  },{cacheName,root:base.href});

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  assert.equal(await page.locator('meta[name="lmn-cache-probe"]').count(),0,'Online reload must replace stale HTML');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cache-probe')),'','Online reload must replace stale CSS');
  assert.deepEqual(await page.locator('.math-main-nav button').allTextContents(),navLabels);
  assert.equal(await page.locator('.math-main-nav [aria-current=page]').innerText(),'课程');

  await page.waitForFunction(async ({cacheName,root})=>{
    const cache=await caches.open(cacheName);
    const html=await cache.match(root),css=await cache.match(new URL('math-site.css',root));
    return html&&css&&!(await html.text()).includes('lmn-cache-probe')&&!(await css.text()).includes('--cache-probe');
  },{cacheName,root:base.href});
  await context.setOffline(true);
  await page.goto(new URL('index.html?offline-check=1',base).href);
  await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
  assert.equal(await page.locator('meta[name="lmn-cache-probe"]').count(),0);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cache-probe')),'');
  assert.deepEqual(await page.locator('.math-main-nav button').allTextContents(),navLabels);
  assert.equal(await page.locator('.math-main-nav [aria-current=page]').innerText(),'课程');

  const saved=await page.evaluate(async root=>{
    const {get,list}=await import(new URL('db.js',root));
    const settings=await get('settings','qa-cache-preserve');
    const note=await get('mathAnnotations','math-note:PROB-K01');
    const session=(await list('studySessions')).find(item=>item.title==='缓存升级前的学习会话');
    return {settings:settings?.value,note:note?.body,attempt:session?.attempts[0]?.content,
      folders:JSON.parse(localStorage.getItem('lmn:math-library:folders'))};
  },base.href);
  assert.deepEqual(saved,{settings:'keep my learning data',note:'保留个人批注',attempt:'先写下四种有序结果。',folders:[{name:'期中复习',items:['PROB-K01']}]});
  assert.deepEqual(errors,[]);
  console.log('PASS: old owned cache cleaned, neighbor cache intact, HTML/CSS refreshed, offline catalog and local data preserved');
  await context.close();
}finally{await browser.close()}
