import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('qa-output',{recursive:true});
try{
 await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 const result=await page.evaluate(async()=>{
  const app=lmnWorkspace,base=new URL('../../',location.href),core=await import(new URL('packages/domain/core.js',base)),model=await import(new URL('packages/structure-engine/model.js',base));
  app.transition.reducedMotion=()=>true;const k=core.createKnowledge('M System · 数学知识工作区');app.state.knowledge.push(k);app.currentKnowledgeId=k.id;app.__next={root:k.id};
  for(const id of ['n-center','function-mapping','commutative-diagram','equivalence-classes','set-partition','cartesian-product','permutation','transformation-group','dynamical-system','flow-network','matrix-grid','coordinate-plane']){
   const template=app.state.structureTemplates.find(t=>t.id==='builtin:'+id),instance=model.createStructureInstance(template,k.id);app.state.structureInstances.push(instance);app.__next[id]=instance.id;app.openInstance(instance.id);app.renderScene();
  }app.openInstance(app.__next['n-center']);app.renderScene();return{models:12,nCenter:app.currentDefinition.slots.length};
 });
 assert.equal(result.nCenter,5);await page.waitForTimeout(100);await page.screenshot({path:'qa-output/n-center.png'});
 await page.evaluate(()=>{lmnWorkspace.navigatorMode='library';lmnWorkspace.renderNavigator();document.querySelector('#navigatorContent').scrollTop=0});assert.ok(await page.locator('.template-miniature').count()>=12);await page.screenshot({path:'qa-output/library.png'});
 await page.evaluate(()=>{lmnWorkspace.openInstance(lmnWorkspace.__next['coordinate-plane']);lmnWorkspace.openPanel('structure',lmnWorkspace.currentInstanceId,'plot')});
 await page.locator('[aria-label="表达式"]').fill('z=sin(x)*cos(y)');await page.getByRole('button',{name:'创建对象',exact:true}).click();await page.waitForTimeout(250);
 result.surface=await page.evaluate(()=>({plots:lmnWorkspace.instance.plotExpressions.length,dimension:lmnWorkspace.instance.parameters.dimension,errors:Object.values(lmnWorkspace.instance.runtimeState.errors)}));
 assert.equal(result.surface.dimension,'3d');assert.equal(result.surface.plots,1);assert.deepEqual(result.surface.errors,[]);await page.screenshot({path:'qa-output/math-workbench.png'});
 await page.evaluate(()=>{lmnWorkspace.openInstance(lmnWorkspace.__next['matrix-grid']);lmnWorkspace.openPanel('structure',lmnWorkspace.currentInstanceId,'matrix')});
 await page.getByRole('button',{name:'计算',exact:true}).click();result.matrix=await page.locator('.matrix-workbench output').textContent();assert.equal(result.matrix,'1\t3\n2\t4');await page.getByRole('button',{name:'将结果写入当前矩阵',exact:true}).click();assert.deepEqual(await page.evaluate(()=>lmnWorkspace.instance.parameters.values),[[1,3],[2,4]]);await page.screenshot({path:'qa-output/matrix.png'});
 await page.evaluate(()=>{const app=lmnWorkspace;app.closePanel();app.state.knowledge.find(x=>x.id===app.__next.root).content='# 曲面与图像\n\n'+String.fromCharCode(96).repeat(3)+'plot\nz=sin(x)*cos(y)\n'+String.fromCharCode(96).repeat(3);app.noteMode='split';app.activateDocument('notes',false,app.__next.root)});
 await page.waitForTimeout(400);assert.equal(await page.locator('.document-plot-viewport').count(),1);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
 await page.locator('#notesEditorHost input[type=file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>lmnWorkspace.knowledge.content.includes('data:image/png;base64,'));
 await page.locator('.document-body-editor').evaluate((el,bytes)=>{el.selectionStart=el.selectionEnd=el.value.length;const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],'pasted.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true}));},png);
 await page.waitForFunction(()=>lmnWorkspace.knowledge.content.includes('pasted'));result.images=await page.locator('.document-editor-preview img').count();assert.equal(result.images,2);await page.screenshot({path:'qa-output/document.png'});
 const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>lmnWorkspace.exportAs('lkl3'));const download=await downloadPromise;await download.saveAs('qa-output/roundtrip.lkl');
 result.archive=await page.evaluate(async()=>{const m=await import(new URL('../../packages/lkl3/package.js',location.href)),text=m.exportLkl3(lmnWorkspace.state),plan=m.buildLkl3ImportPlan(text,lmnWorkspace.state,{strategy:'copy',copyId:'qa-copy'});return{committable:plan.committable,errors:plan.errors,records:plan.document.records.length};});assert.equal(result.archive.committable,true,result.archive.errors.join('\n'));
 await page.evaluate(()=>{document.querySelector('#importDialog').showModal();document.querySelector('#importStrategy').value='merge'});await page.locator('#fileInput').setInputFiles('qa-output/roundtrip.lkl');await page.waitForFunction(()=>!!lmnWorkspace.importCandidate);await page.locator('#confirmImport').click();await page.waitForFunction(()=>!document.querySelector('#importDialog').open);
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);assert.ok(await page.evaluate(()=>lmnWorkspace.state.knowledge.some(k=>k.content?.includes('pasted'))));
 result.labels=await page.evaluate(async()=>{
  const base=new URL('../../',location.href),{renderStructure}=await import(new URL('packages/ui/structure-renderer.js',base)),{createStructureInstance}=await import(new URL('packages/structure-engine/model.js',base));
  const host=document.createElement('section');host.id='label-qa';Object.assign(host.style,{position:'fixed',inset:'0',zIndex:9999,background:'#faf9f6'});const sceneRoot=document.createElement('div');sceneRoot.className='scene-root';host.append(sceneRoot);document.body.append(host);const layers={};
  for(const key of ['backgroundLayer','geometryLayer','edgeLayer']){layers[key]=document.createElementNS('http://www.w3.org/2000/svg','svg');sceneRoot.append(layers[key]);}for(const key of ['nodeLayer','tokenLayer']){layers[key]=document.createElement('div');layers[key].className=key==='nodeLayer'?'node-layer':'token-layer';sceneRoot.append(layers[key]);}
  const slots=['a','b','c','d'].map(id=>({id,label:id,role:'object',cardinality:'many',accepts:['knowledge'],semanticCoordinate:{}})),template={id:'qa:labels',version:1,name:'关系显示验收',slots,edges:[{id:'a-b',sourceSlotId:'a',targetSlotId:'b',direction:'directed',label:'localize',relationType:'implies'},{id:'c-d',sourceSlotId:'c',targetSlotId:'d',direction:'directed',label:'依赖与边界：一致收敛下的极限交换',relationType:'implies'},{id:'a-c',sourceSlotId:'a',targetSlotId:'c',direction:'directed',label:'$f_n \\to f$',relationType:'implies'}],layout:{type:'manual',positions:{a:{x:100,y:100},b:{x:900,y:500},c:{x:100,y:500},d:{x:900,y:100}}},parameters:[],variables:[],constraints:[],rules:[],visual:{}};
  renderStructure({template,instance:createStructureInstance(template),sceneRoot,...layers});const groups=[...layers.edgeLayer.querySelectorAll('.relation-label-layer>g')];return{count:groups.length,lastLayer:layers.edgeLayer.lastElementChild.classList.contains('relation-label-layer'),cutouts:groups.filter(g=>g.querySelector('text')).every(g=>{const t=g.querySelector('text').getBBox(),r=g.querySelector('rect');return+r.getAttribute('width')>=t.width+12&&getComputedStyle(r).fillOpacity==='1';})};
 });
 assert.equal(result.labels.count,3);assert.equal(result.labels.lastLayer,true);assert.equal(result.labels.cutouts,true);await page.screenshot({path:'qa-output/relations.png'});await page.locator('#label-qa').evaluate(el=>el.remove());
 await page.evaluate(()=>lmnWorkspace.openLklManual());assert.ok(await page.locator('#lklManualContent h2').count()>=8);assert.equal(await page.locator('#lklManualContent').isVisible(),true);await page.screenshot({path:'qa-output/manual.png'});const offline=await browser.newContext(),offlinePage=await offline.newPage();await offlinePage.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});await offlinePage.evaluate(()=>navigator.serviceWorker.ready);await offlinePage.waitForFunction(()=>!!navigator.serviceWorker.controller);await offline.setOffline(true);await offlinePage.reload();await offlinePage.waitForFunction(()=>!!globalThis.lmnWorkspace);result.offline=await offlinePage.locator('.brand em').textContent();assert.equal(result.offline,'V5.1.2');await offline.close();
 result.errors=errors;assert.deepEqual(errors,[]);console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}


