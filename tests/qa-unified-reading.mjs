import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('qa-output',{recursive:true});
try{
 await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 const ids=await page.evaluate(async()=>{
  const {createKnowledge}=await import('../../packages/domain/core.js'),{createStructureInstance}=await import('../../packages/structure-engine/model.js'),a=lmnWorkspace,k=createKnowledge('Unified knowledge','Knowledge explanation');a.state.knowledge.push(k);
  const instances=['builtin:directed-graph','builtin:coordinate-plane'].map((templateId,n)=>{const i=createStructureInstance(a.state.structureTemplates.find(t=>t.id===templateId),k.id);i.title='View '+n;i.objectContent.body='Structure explanation '+n;a.state.structureInstances.push(i);return i});
  a.openKnowledge(k.id);return {knowledge:k.id,first:instances[0].id,vector:instances[1].id};
 });
 assert.equal(await page.locator('#navigatorContent [data-kind=knowledge]').count(),1);
 assert.equal(await page.locator('#navigatorContent [data-kind=structure]').count(),0);
 assert.equal(await page.locator('#navigatorContent [data-kind=note]').count(),0);
 assert.equal(await page.locator('#toggleKnowledgeNotes').getAttribute('aria-expanded'),'false');
 await page.locator('#toggleKnowledgeNotes').click();
 assert.match(await page.locator('#knowledgeReader .document-editor-preview').innerText(),/Knowledge explanation/);
 const bounds=await page.evaluate(()=>({canvas:document.querySelector('#canvasViewport').getBoundingClientRect().toJSON(),reader:document.querySelector('#knowledgeReader').getBoundingClientRect().toJSON()}));
 assert(bounds.canvas.width>300);assert(bounds.reader.width>300);assert(Math.abs(bounds.canvas.right-bounds.reader.left)<2);
 await page.screenshot({path:'qa-output/unified-reading.png'});
 await page.locator('#readingSourceSelect').selectOption('structure');assert.match(await page.locator('#knowledgeReader .document-editor-preview').innerText(),/Structure explanation 0/);
 await page.locator('#readingSourceSelect').selectOption('knowledge');await page.locator('#knowledgeReader').getByRole('button',{name:'编辑',exact:true}).click();
 await page.locator('#knowledgeReader .document-body-editor').fill('Edited knowledge in split view');
 await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.includes('已保存'));
 await page.locator('#knowledgeStructureSelect').selectOption(ids.vector);
 assert.equal(await page.locator('#toggleKnowledgeNotes').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#knowledgeReader .document-body-editor').inputValue(),'Edited knowledge in split view');
 await page.locator('#knowledgeReader').getByRole('button',{name:'关闭正文',exact:true}).click();
 await page.locator('#structureSettingsButton').click();
 const sizes=[];
 for(const name of ['设置','变量','操作','设计','变量']){
  await page.locator('#panelTabs').getByRole('button',{name,exact:true}).click();
  const box=await page.locator('#floatingPanel').boundingBox();sizes.push([box.width,box.height]);
 }
 assert(sizes.every(s=>s[0]===360&&s[1]===sizes[0][1]),JSON.stringify(sizes));
 await page.evaluate(()=>{lmnWorkspace.addPlotExpression('y=x^2');lmnWorkspace.openPanel('structure',lmnWorkspace.instance.id,'variables')});
 await page.screenshot({path:'qa-output/unified-panel-variables.png'});
 await page.locator('#panelTabs').getByRole('button',{name:'操作',exact:true}).click();
 await page.screenshot({path:'qa-output/unified-panel-operations.png'});
 const overflows=await page.locator('#floatingPanel input:visible,#floatingPanel select:visible,#floatingPanel textarea:visible').evaluateAll(elements=>{const panel=document.querySelector('#floatingPanel').getBoundingClientRect();return elements.filter(e=>!e.closest('.variable-table')&&e.getBoundingClientRect().right>panel.right+1).map(e=>e.outerHTML)});assert.deepEqual(overflows,[]);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#floatingPanel').getBoundingClientRect().width<=innerWidth);
 const small=[];for(const name of ['设置','变量','操作']){await page.locator('#panelTabs').getByRole('button',{name,exact:true}).click();small.push((await page.locator('#floatingPanel').boundingBox()).width)}assert(small.every(w=>w===small[0]));
 await page.screenshot({path:'qa-output/unified-panel-mobile.png'});
 await page.locator('#closePanel').click();await page.locator('#toggleKnowledgeNotes').click();
 assert.equal(await page.locator('#knowledgeReader .document-body-editor').inputValue(),'Edited knowledge in split view');
 await page.reload();await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 assert.equal(await page.evaluate(id=>lmnWorkspace.state.knowledge.find(k=>k.id===id).content,ids.knowledge),'Edited knowledge in split view');
 await page.evaluate(id=>lmnWorkspace.openKnowledge(id),ids.knowledge);assert.equal(await page.locator('#toggleKnowledgeNotes').getAttribute('aria-expanded'),'false');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({unifiedNavigation:true,splitReading:true,independentBodies:true,persisted:true,sidebarSizes:sizes,mobileWidths:small,pageErrors:errors}));
}catch(error){await page.screenshot({path:'qa-output/unified-failure.png'});throw error}finally{await browser.close()}
