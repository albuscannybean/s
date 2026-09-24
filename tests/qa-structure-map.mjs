import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 const ids=await page.evaluate(async()=>{
  const a=lmnWorkspace,{createStructureInstance,materializeInstanceDefinition,addInstanceEdge}=await import('/packages/structure-engine/model.js'),{addContainerContent}=await import('/packages/domain/semantic-container.js');
  a.transition.reducedMotion=()=>true;
  const template=a.state.structureTemplates.find(t=>t.id==='builtin:directed-graph'),ids=[];
  for(let n=0;n<2;n++){
   const instance=createStructureInstance(template,null,{nodeCount:3});instance.objectContent.body='Structure body '+n;
   const definition=materializeInstanceDefinition(template,instance);instance.overrides.removedEdgeIds=definition.edges.map(e=>e.id);
   addInstanceEdge(instance,'A','B');addInstanceEdge(instance,'A','C');
   for(const id of ['A','B','C'])addContainerContent(instance,id,{id:'note-'+n+'-'+id,type:'content',content:{title:id,body:'Node '+id}},definition);
   a.state.structureInstances.push(instance);ids.push(instance.id);
  }
  a.openInstance(ids[0]);return ids;
 });
 for(let n=0;n<2;n++){
  const selector=await page.evaluate(id=>{const a=lmnWorkspace;a.openInstance(id);const index=a.navigationIndex(),entry=index.find({kind:'note',id:'structure-body',instanceId:id,contentScope:'structure'});a.navExpanded().add(index.find({kind:'structure',id}).key);a.renderNavigator();return '[data-object-key="'+CSS.escape(entry.key)+'"] .nav-location-open'},ids[n]);
  await page.locator(selector).click();assert.match(await page.locator('#contentDocumentContent').innerText(),new RegExp('Structure body '+n));
 }
 await page.evaluate(id=>{const a=lmnWorkspace,e=a.navigationIndex().find({kind:'note',id:'structure-body',instanceId:id,contentScope:'structure'});a.openSearchResult(e)},ids[0]);
 await page.locator('#contentDocumentContent').getByRole('button',{name:'编辑',exact:true}).click();
 await page.locator('#contentDocumentContent .document-body-editor').fill('Edited structure body');
 await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.includes('已保存'));
 await page.reload();await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 assert.equal(await page.evaluate(id=>lmnWorkspace.state.structureInstances.find(i=>i.id===id).objectContent.body,ids[0]),'Edited structure body');
 assert.equal(await page.evaluate(id=>lmnWorkspace.state.structureInstances.find(i=>i.id===id).objectContent.body,ids[1]),'Structure body 1');
 await page.evaluate(id=>lmnWorkspace.openInstance(id),ids[0]);
 await page.locator('#nodeLayer [data-slot-id=A]').click();
 await page.waitForFunction(()=>lmnWorkspace.document.startsWith('content:'));
 await page.locator('#structureMapButton').click();assert.equal(await page.locator('.map-next-choice').count(),2);
 await page.locator('[data-next-slot-id=B]').click();
 assert.equal(await page.locator('#contentDocumentContent .document-body-editor').inputValue(),'Node B');
 await page.locator('#structureMapButton').click();assert.equal(await page.locator('.map-node.is-current').getAttribute('data-map-slot-id'),'B');assert.equal(await page.locator('.map-next-choice').count(),0);
 await page.locator('[data-map-slot-id=C]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#contentDocumentContent .document-body-editor').inputValue(),'Node C');
 await page.locator('#structureMapButton').click();await page.keyboard.press('Escape');
 assert.equal(await page.locator(':focus').getAttribute('id'),'structureMapButton');
 await page.evaluate(id=>lmnWorkspace.openInstance(id),ids[0]);
 await page.waitForFunction(()=>!lmnWorkspace.scheduler.frame&&!lmnWorkspace.transition.frame);
 const node=page.locator('#nodeLayer [data-slot-id=A]');await node.waitFor({state:'visible'});const box=await node.evaluate(e=>e.getBoundingClientRect().toJSON());
 await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.mouse.move(box.x+100,box.y+90,{steps:10});await page.mouse.up();
 assert((await page.evaluate(()=>lmnWorkspace.document)).startsWith('structure:'));
 await node.focus();
 // A pending drag frame must not detach keyboard focus from the rebuilt node.
 await page.evaluate(()=>lmnWorkspace.renderScene());
 assert.equal(await page.locator(':focus').getAttribute('data-slot-id'),'A');
 await page.keyboard.press('Enter');await page.waitForFunction(()=>lmnWorkspace.document.startsWith('content:'));
 await page.locator('#structureMapButton').click();await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.querySelector('#structureMapDialog').getBoundingClientRect().width<=innerWidth);
 assert(await page.locator('#structureMapDialog').evaluate(e=>e.getBoundingClientRect().width<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: structure notes, persistence, click/drag, map branches, keyboard, focus, narrow screen');
}finally{await browser.close()}
