YªçŠx%¢ŠEK¬uç%j·Â+ar‰ì¶ë•ë_¢ºÞjË"‚v›•ëÚ®&›•ëj¹âž	h¢“Ú¶±×œ•ªÞw­…Ê'²Û¬zW­~Šëy«,Š	ÚnW¯j¸šnW¬YªçŠx%¢ŠQ¢‹pjÇ^rV«yÜ"¶(žËn±é^µú+­æ¬²('i¹^½ªâi¹^±f«ž)à–Š)
¼©¶Œ±×œ•ªÞw­…Ê'²Û¬zW­~Šëy«,Š	ÚnW¯j¸šnW¬YªçŠx%¢ŠQy§pjÇ^rV«yÜ"¶(žËn±é^µú+­æ¬²('i¹^½ªâi¹^±f«ž)à–Š)Z¸­{¬uç%j·Â+ar‰ì¶ë•ë_¢ºÞjË"‚v›•ëÚ®&›•ëj¹âž	h¢‘ŠÜ±×œ•ªÞw­…Ê'²Û¬zW­~Šëy«,Š	ÚnW¯j¸šnW¬import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('qa-output',{recursive:true});
try{
 await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 await page.evaluate(()=>{lmnWorkspace.transition.reducedMotion=()=>true;lmnWorkspace.insertTemplate('builtin:lattice');lmnWorkspace.openPanel('structure',lmnWorkspace.instance.id,'workbench')});
 await page.getByRole('button',{name:'ï¼‹ æ·»åŠ å…ƒç´ ',exact:true}).click();await page.locator('#textPromptInput').fill('e5');await page.locator('#textPromptConfirm').click();
 await page.waitForFunction(()=>lmnWorkspace.currentDefinition.slots.some(s=>s.label==='e5'));
 await page.evaluate(()=>{const a=lmnWorkspace;a.openInstance(a.instance.id);const d=a.currentDefinition,e=d.slots.find(s=>s.label==='e5');for(const label of ['{a}','{b}']){a.startTemporaryConnection(d.slots.find(s=>s.label===label).id);a.connectSlot(e.id)}a.openPanel('structure',a.instance.id,'workbench')});
 const rank=page.locator('.poset-ranks label').filter({hasText:'e5'}).locator('input');await rank.fill('5');await rank.dispatchEvent('change');
 const poset=await page.evaluate(()=>{const a=lmnWorkspace,e=a.currentScene.nodes.find(n=>n.label==='e5');return{rank:e.semanticCoordinate.rank,y:e.y,edges:a.currentScene.edges.filter(x=>x.targetSlotId===e.id).length,parents:a.currentScene.nodes.filter(n=>['{a}','{b}'].includes(n.label)).map(n=>n.y)}});
 assert.equal(poset.rank,5);assert.equal(poset.edges,2);assert.ok(poset.parents.every(y=>y>poset.y));await page.screenshot({path:'qa-output/v513-poset.png'});
 await page.evaluate(()=>{lmnWorkspace.closePanel();lmnWorkspace.insertTemplate('builtin:tree')});
 const initialY=await page.evaluate(()=>lmnWorkspace.currentScene.nodes.find(n=>n.id==='left').y);
 const leftBounds=await page.waitForFunction(()=>{
   const node=document.querySelector('#nodeLayer [data-slot-id=left]');
   if(!node)return null;
   const {x,y,width,height}=node.getBoundingClientRect();
   return width>0&&height>0?{x,y,width,height}:null;
 });
 const box=await leftBounds.jsonValue();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+155,{steps:12});await page.mouse.up();
 const tree=await page.evaluate(()=>{const a=lmnWorkspace,root=a.currentScene.nodes.find(n=>n.id==='root'),children=a.currentScene.nodes.filter(n=>n.id!=='root');return{rootX:root.x,childX:children.map(n=>n.x),drag:a.instance.layoutState.nodePositions.left,zoom:a.view.zoom}});
 assert.ok(tree.childX.every(x=>x>tree.rootX));assert.ok(tree.drag&&Math.abs((tree.drag.y-initialY)*tree.zoom-155)<2);await page.screenshot({path:'qa-output/v513-tree.png'});
 await page.evaluate(()=>{lmnWorkspace.insertTemplate('builtin:coordinate-plane');globalThis.vectorId=lmnWorkspace.instance.id;lmnWorkspace.openPanel('structure',vectorId,'settings')});
 const projection=page.locator('#floatingPanel .field').filter({hasText:'è§‚å¯Ÿè§†è§’'}).locator('select');await projection.selectOption('free');
 assert.equal(await page.evaluate(()=>lmnWorkspace.instance.structureView.camera.projection),'free');assert.equal(await page.evaluate(()=>lmnWorkspace.instance.parameters.dimension),'3d');
 await page.evaluate(()=>lmnWorkspace.openPanel('structure',vectorId,'plot'));assert.equal(await page.locator('.plot-dimension').count(),0);
 await page.locator('#plotExpressionInput').fill('y=x^2');await page.getByRole('button',{name:'åˆ›å»ºå¯¹è±¡',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>({projection:lmnWorkspace.instance.structureView.camera.projection,range:lmnWorkspace.instance.plotExpressions[0].rangeMode,name:lmnWorkspace.instance.plotExpressions[0].label})),{projection:'free',range:'viewport',name:'Câ‚€'});
 await page.evaluate(()=>{lmnWorkspace.addPlotExpression('ellipse(cx=0,cy=0,a=4,b=2.5)')});
 const editor=page.locator('.coordinate-variable-editor');assert.equal(await editor.locator('input[name=color]').count(),1);assert.equal(await editor.locator('input[name=end]').count(),1);
 const motion=page.locator('.motion-point-workbench');assert.equal(await motion.locator('input[name=start]').count(),1);assert.equal(await motion.locator('input[name=end]').count(),1);
 await motion.getByRole('button',{name:'æ·»åŠ åŠ¨ç‚¹',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>lmnWorkspace.instance.motionPoints.map(p=>({label:p.label,valid:Number.isFinite(p.start)&&Number.isFinite(p.end)&&p.start!==p.end}))),[{label:'Pâ‚€',valid:true}]);
 assert.doesNotMatch(await page.locator('#floatingPanel').innerText(),/<(?:è¾“å…¥|input)\b/);
 await page.evaluate(()=>{lmnWorkspace.openPanel('structure',vectorId,'settings')});await page.locator('#floatingPanel .field').filter({hasText:'è§‚å¯Ÿè§†è§’'}).locator('select').selectOption('xOy');
 await page.evaluate(()=>{lmnWorkspace.closePanel();lmnWorkspace.fit();lmnWorkspace.setZoom(.85);lmnWorkspace.view.panX=125;lmnWorkspace.view.panY=95;lmnWorkspace.applyViewTransform();globalThis.savedView={...lmnWorkspace.view}});
 const views=await page.evaluate(()=>{const a=lmnWorkspace,other=a.state.structureInstances.find(i=>i.templateId==='builtin:tree');const values=[];for(let n=0;n<8;n++){a.openInstance(other.id);a.openInstance(vectorId);values.push({...a.view})}return{saved:savedView,values}});
 for(const view of views.values)assert.deepEqual(view,views.saved);
 await page.evaluate(()=>{lmnWorkspace.fit();lmnWorkspace.renderScene()});
 const camera=await page.evaluate(()=>({view:lmnWorkspace.view,fit:lmnWorkspace.currentScene.fitBounds,errors:Object.values(lmnWorkspace.instance.runtimeState.errors)}));assert.ok(camera.view.zoom>.4);assert.deepEqual(camera.errors,[]);
 await page.screenshot({path:'qa-output/v513-coordinate.png'});
 await page.evaluate(()=>{lmnWorkspace.preferences.language='en';document.documentElement.lang='en';lmnWorkspace.selection=new Set(['plot:'+lmnWorkspace.instance.plotExpressions[1].id]);lmnWorkspace.openPanel('structure',vectorId,'variables')});
 assert.equal(await page.locator('.motion-point-workbench').getByRole('button',{name:'Add moving point',exact:true}).count(),1);
 assert.doesNotMatch(await page.locator('.coordinate-variable-manager').innerText(),/[\u4e00-\u9fff]/);await page.waitForTimeout(220);
 await page.screenshot({path:'qa-output/v513-motion-en.png'});
 assert.deepEqual(errors,[]);const result={poset,tree,camera,views,errors};await writeFile('qa-output/v513-web.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){console.log(JSON.stringify(await page.evaluate(()=>({errors:globalThis.lmnWorkspace?.instance?.runtimeState?.errors,slots:globalThis.lmnWorkspace?.currentDefinition?.slots.map(s=>({id:s.id,label:s.label})),added:globalThis.lmnWorkspace?.instance?.overrides?.addedSlots,document:globalThis.lmnWorkspace?.document,status:document.querySelector('#saveStatus')?.textContent}))),errors);await page.screenshot({path:'qa-output/v513-failure.png'});throw error}finally{await browser.close()}
