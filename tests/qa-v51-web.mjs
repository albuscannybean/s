import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('qa-output',{recursive:true});
try{
 await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 const result=await page.evaluate(async()=>{
  const app=lmnWorkspace,base=new URL('../../',location.href),model=await import(new URL('packages/structure-engine/model.js',base)),core=await import(new URL('packages/domain/core.js',base));
  app.transition.reducedMotion=()=>true;const template=app.state.structureTemplates.find(t=>t.id==='builtin:directed-graph'),root=core.createKnowledge('多层知识根'),child=core.createKnowledge('最终知识：保留用户中文');root.id='qa:根/1';child.id='qa:知识/2';child.content='这是需要搜索的独立正文 unique-deep-body';app.state.knowledge.push(root,child);
  let previous=null,first=null,last=null;
  for(let i=0;i<7;i++){const instance=model.createStructureInstance(template,root.id,{nodeCount:3,topology:'network',layoutMode:'linear'});instance.id='qa:结构/'+i;instance.displayTitle='第'+i+'层结构';app.state.structureInstances.push(instance);if(previous)model.bindTarget(previous,template,'A','structure',instance.id,{placementMode:'construct'});else first=instance;previous=last=instance;}
  model.bindTarget(last,template,'A','knowledge',child.id,{placementMode:'construct'});model.bindTarget(first,template,'B','knowledge',child.id,{placementMode:'reference'});
  app.state.contentObjects.push({id:'qa:独立正文',title:'独立档案',body:'unassigned-test-body'});app.state.knowledgePackages.push({rootKnowledgeId:root.id});
  app.__qa51={root:root.id,child:child.id,first:first.id,last:last.id};app.openKnowledge(root.id);document.querySelector('#navigatorFilter').value='unique-deep-body';app.navigatorMode='search';app.searchMode='text';app.renderNavigator();
  return{root:root.id,child:child.id};
 });
 await page.locator('#navigatorContent .nav-item').filter({hasText:'最终知识'}).click();
 result.address=await page.evaluate(()=>({path:lmnWorkspace.path.map(s=>s.id),query:document.querySelector('#navigatorFilter').value,mode:lmnWorkspace.navigatorMode,document:lmnWorkspace.document}));
 assert.equal(result.address.path[0],result.root);assert.ok(result.address.path.includes('qa:结构/6'));assert.equal(result.address.path.at(-1),result.child);assert.equal(result.address.query,'');assert.equal(result.address.mode,'outline');
 const firstToggle=page.locator('.nav-location-row[data-kind=structure]').first().locator('.nav-location-toggle');
 await firstToggle.click();assert.equal(await page.locator('.nav-location-row[data-kind=structure]').first().getAttribute('aria-expanded'),'false');
 await firstToggle.click();assert.equal(await page.locator('.nav-location-row[data-kind=structure]').first().getAttribute('aria-expanded'),'true');
 result.navigation=await page.evaluate(()=>{const root=document.querySelector('#navigatorContent'),rows=[...root.querySelectorAll('.nav-location-row')],keys=rows.map(r=>r.dataset.navKey),rects=rows.map(r=>r.getBoundingClientRect());return{overflow:root.scrollWidth-root.clientWidth,unique:new Set(keys).size===keys.length,overlap:rects.some((r,i)=>i&&r.top<rects[i-1].bottom-1),maxIndent:Math.max(...rows.map(r=>Number(r.style.getPropertyValue('--indent'))))}});
 assert.ok(result.navigation.overflow<=1);assert.equal(result.navigation.unique,true);assert.equal(result.navigation.overlap,false);assert.ok(result.navigation.maxIndent<=3);await page.screenshot({path:'qa-output/v51-navigation.png'});
 result.structureSearchAddress=await page.evaluate(()=>{const app=lmnWorkspace,opened=app.openSearchResult({kind:'structure',instanceId:app.__qa51.last},{highlight:{slotIds:['A']}});return{opened,path:app.path.map(s=>s.id),instanceId:app.currentInstanceId}});assert.equal(result.structureSearchAddress.opened,true);assert.equal(result.structureSearchAddress.instanceId,'qa:结构/6');assert.equal(result.structureSearchAddress.path[0],result.root);
 await page.evaluate(()=>lmnWorkspace.openSearchResult({kind:'content',id:'qa:独立正文',contentScope:'global'}));assert.ok((await page.locator('#contentDocumentContent').textContent()).includes('unassigned-test-body'));
 await page.evaluate(async()=>{const app=lmnWorkspace,{createStructureInstance,addInstanceEdge}=await import(new URL('../../packages/structure-engine/model.js',location.href)),center=app.state.structureTemplates.find(t=>t.id==='builtin:n-center'),instance=createStructureInstance(center,app.__qa51.root,{nodeCount:7,numbering:'custom',numberFormat:'P{n}',numberStart:1});app.state.structureInstances.push(instance);app.openInstance(instance.id);app.addSlot();app.closePanel();app.renderScene();app.__qa51.center=instance.id});
 result.center=await page.evaluate(()=>({count:lmnWorkspace.instance.parameters.nodeCount,labels:lmnWorkspace.currentDefinition.slots.map(s=>s.label)}));assert.equal(result.center.count,8);assert.ok(result.center.labels.includes('P8'));await page.screenshot({path:'qa-output/v51-center.png'});
 await page.evaluate(()=>{const app=lmnWorkspace;app.openGlobalSettings();const input=document.querySelector('[data-global-pref=language]');input.value='en';app.updateGlobalPreference(input)});assert.equal(await page.locator('html').getAttribute('lang'),'en');await page.screenshot({path:'qa-output/v51-settings-en.png'});
 await page.evaluate(()=>{const app=lmnWorkspace;app.openInstance(app.__qa51.center);app.openPanel('structure',app.currentInstanceId,'settings')});
 result.englishPanel=await page.locator('#floatingPanel').innerText();assert.doesNotMatch(result.englishPanel,/[\u3400-\u9fff]/);await page.screenshot({path:'qa-output/v51-panel-en.png'});
 await page.evaluate(()=>{lmnWorkspace.closePanel();lmnWorkspace.navigatorMode='library';lmnWorkspace.renderNavigator()});
 result.library=await page.locator('.nav-library-card b').allTextContents();assert.ok(result.library.includes('Directed Node Graph'));assert.ok(result.library.some(s=>/Center/i.test(s)));assert.ok(result.library.every(s=>!s.includes(' · ')&&!/[\u3400-\u9fff]/.test(s)));await page.screenshot({path:'qa-output/v51-library-en.png'});
 await page.evaluate(()=>lmnWorkspace.openLklManual());result.manual=await page.locator('#lklManualContent').innerText();assert.ok(result.manual.includes('LKL'));
 await page.evaluate(()=>{const app=lmnWorkspace;app.openGlobalSettings();const input=document.querySelector('[data-global-pref=language]');input.value='zh-CN';app.updateGlobalPreference(input);app.openKnowledge(app.__qa51.child)});
 assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');assert.equal(await page.evaluate(()=>lmnWorkspace.knowledge.title),'最终知识：保留用户中文');
 assert.deepEqual(errors,[]);result.errors=errors;await writeFile('qa-output/v51-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,manual:result.manual.slice(0,180)},null,2));
}finally{await browser.close()}

