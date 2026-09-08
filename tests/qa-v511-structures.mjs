import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('qa-output',{recursive:true});
try{
 await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 await page.evaluate(()=>{lmnWorkspace.transition.reducedMotion=()=>true;lmnWorkspace.navigatorMode='library';lmnWorkspace.renderNavigator()});
 const templates=await page.evaluate(()=>lmnWorkspace.state.structureTemplates.filter(t=>!t.hidden&&!t.deprecated).map(t=>({id:t.id,parameters:t.parameters.length})));
 const catalog=[];
 for(const template of templates){
  await page.locator('#navigatorContent [data-template-id]').filter({has:page.locator('span')}).evaluateAll((buttons,id)=>{const button=buttons.find(b=>b.dataset.templateId===id);if(!button)throw new Error('Missing library item '+id);button.click();},template.id);
  await page.locator('#structureConfigDialog').waitFor({state:'visible'});
  const result=await page.evaluate(()=>{
   const dialog=document.querySelector('#structureConfigDialog'),svg=dialog.querySelector('#configPreview svg');
   return{id:lmnWorkspace.librarySelection.templateId,parameters:dialog.querySelectorAll('#configParameters input[data-parameter-id],#configParameters select[data-parameter-id],#configParameters textarea[data-parameter-id]').length,status:svg?.dataset.previewStatus,nodeCount:Number(svg?.dataset.nodeCount),edgeCount:Number(svg?.dataset.edgeCount),valid:!dialog.querySelector('#confirmStructureInsert').disabled};
  });
  assert.equal(result.parameters,template.parameters,template.id);assert.ok(['ready','empty'].includes(result.status),template.id);assert.ok(result.valid,template.id);catalog.push(result);
  await page.evaluate(()=>document.querySelector('#structureConfigDialog').close());
 }
 await page.evaluate(()=>lmnWorkspace.openStructureConfiguration('builtin:boolean-algebra'));
 await page.locator('#configParameters input[data-parameter-id=rank]').fill('99');
 assert.equal(await page.locator('#confirmStructureInsert').isDisabled(),true);
 await page.locator('#configParameters input[data-parameter-id=rank]').fill('4');
 assert.equal(await page.locator('#confirmStructureInsert').isEnabled(),true);
 await page.screenshot({path:'qa-output/v511-boolean-config.png'});
 await page.locator('#confirmStructureInsert').click();
 await page.waitForFunction(()=>lmnWorkspace.currentScene?.nodes.length===16);
 const boolean=await page.evaluate(()=>({n:lmnWorkspace.currentScene.nodes.length,e:lmnWorkspace.currentScene.edges.length,routing:[...new Set(lmnWorkspace.currentScene.edges.map(e=>e.routing))]}));
 assert.deepEqual(boolean,{n:16,e:32,routing:['straight']});await page.screenshot({path:'qa-output/v511-boolean.png'});
 await page.evaluate(()=>lmnWorkspace.openStructureConfiguration('builtin:mod-n'));await page.locator('#confirmStructureInsert').click();
 await page.waitForFunction(()=>lmnWorkspace.currentScene?.templateId==='builtin:mod-n');
 const ring=await page.evaluate(()=>({n:lmnWorkspace.currentScene.nodes.length,e:lmnWorkspace.currentScene.edges.length,arcs:lmnWorkspace.currentScene.edges.every(e=>e.path.includes(' A '))}));
 assert.deepEqual(ring,{n:12,e:12,arcs:true});await page.screenshot({path:'qa-output/v511-modular.png'});
 const styles=await page.evaluate(async()=>{
  const {setRelationStyle}=await import(new URL('../../packages/structure-engine/relation-style-resolver.js',location.href)),app=lmnWorkspace,results=[];
  for(const routing of ['straight','bezier','orthogonal','radial-arc']){setRelationStyle(app.instance,{scope:'all'},{routing});app.renderScene();results.push({routing,actual:[...new Set(app.currentScene.edges.map(e=>e.routing))]})}
  return results;
 });
 for(const style of styles)assert.deepEqual(style.actual,[style.routing]);
 await page.evaluate(()=>lmnWorkspace.openPanel('edge',lmnWorkspace.currentDefinition.edges[0].id,'appearance'));
 await page.locator('#floatingPanel .field select').first().selectOption('bezier');
 const singleEdge=await page.evaluate(()=>lmnWorkspace.currentScene.edges.map(e=>e.routing));
 assert.equal(singleEdge[0],'bezier');assert.ok(singleEdge.slice(1).every(r=>r==='radial-arc'));
 await page.evaluate(()=>lmnWorkspace.closePanel());

 await page.evaluate(()=>lmnWorkspace.openStructureConfiguration('builtin:poset-hasse'));
 await page.locator('#configParameters textarea[data-parameter-id=relationText]').fill('a < b < d; a < c < d');
 assert.equal(await page.locator('#configParameters select[data-parameter-id=starter]').inputValue(),'relation-text');
 await page.locator('#confirmStructureInsert').click();await page.waitForFunction(()=>lmnWorkspace.currentScene?.templateId==='builtin:poset-hasse');
 const poset=await page.evaluate(()=>({n:lmnWorkspace.currentScene.nodes.length,e:lmnWorkspace.currentScene.edges.length}));assert.deepEqual(poset,{n:4,e:4});
 await page.screenshot({path:'qa-output/v511-poset.png'});
 await page.evaluate(()=>lmnWorkspace.openStructureConfiguration('builtin:poset-hasse'));
 await page.locator('#configParameters select[data-parameter-id=starter]').selectOption('blank');await page.locator('#confirmStructureInsert').click();
 await page.locator('.empty-structure-actions').waitFor({state:'visible'});
 await page.locator('.empty-structure-actions button').first().click();assert.equal(await page.locator('#floatingPanel').isVisible(),true);
 await page.evaluate(()=>{lmnWorkspace.closePanel();lmnWorkspace.preferences.language='en';document.documentElement.lang='en';lmnWorkspace.openStructureConfiguration('builtin:matrix-grid')});
 assert.equal(await page.locator('#confirmStructureInsert').innerText(),'Insert structure');assert.equal(await page.locator('#configParameters input[data-parameter-id=rows]').count(),1);
 await page.evaluate(()=>document.querySelector('#structureConfigDialog').close());
 const scheme=await page.evaluate(()=>{const a=lmnWorkspace,s=a.state.variableSchemes.find(s=>!s.hidden);a.openSchemeConfiguration(s.id,true);return{id:s.id,fields:document.querySelectorAll('#configParameters input,#configParameters textarea').length}});
 assert.ok(scheme.fields>0);await page.evaluate(()=>document.querySelector('#structureConfigDialog').close());
 assert.deepEqual(errors,[]);
 const result={catalog,boolean,ring,styles,poset,scheme,errors};await writeFile('qa-output/v511-structures.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}

