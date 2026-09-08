import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LMN_BROWSER_EXECUTABLE?{executablePath:process.env.LMN_BROWSER_EXECUTABLE}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[],result={};
page.on('pageerror',error=>errors.push(error.message));await mkdir('qa-output',{recursive:true});
const rowFor=async target=>page.locator(await page.evaluate(target=>{const entry=lmnWorkspace.navigationIndex().find(target);if(!entry)throw new Error('Missing test target '+JSON.stringify(target));return '.nav-location-row[data-object-key="'+CSS.escape(entry.key)+'"]';},target)).first();
try{
 await page.goto(process.env.LMN_QA_URL||'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 await page.evaluate(async()=>{
  const app=lmnWorkspace,{createKnowledge}=await import(new URL('../../packages/domain/core.js',location.href));app.transition.reducedMotion=()=>true;
  app.state.knowledge=['A','B','C'].map(letter=>({...createKnowledge('QA511 '+letter,'Body '+letter),id:'qa511:'+letter}));
  for(const key of ['relations','representations','structureInstances','knowledgePackages','contentObjects','structureViews','boards'])app.state[key]=[];
  app.state.placements=[{id:'qa511:initial-location',parentType:'knowledge',parentId:'qa511:A',targetType:'knowledge',targetId:'qa511:B',mode:'construct'}];
  app.preferences.language='zh-CN';app.savePreferences();app.openKnowledge('qa511:A');
 });
 assert.equal(await page.locator('#navigatorTitle').innerText(),'内容库');

 await page.getByRole('button',{name:'＋ 正文',exact:true}).click();
 await page.locator('#contentDocumentContent .document-title-input').fill('QA511 未归类正文');
 const noteBody='## 可独立保存的正文\n\n![tiny](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6J94AAAAASUVORK5CYII=)\n\nIndependent content survives reload.';
 await page.locator('#contentDocumentContent .document-body-editor').fill(noteBody);
 result.note=await page.evaluate(()=>lmnWorkspace.state.contentObjects.find(item=>item.title==='QA511 未归类正文').id);
 await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.includes('已保存'));
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace);
 assert.equal(await page.evaluate(id=>lmnWorkspace.state.contentObjects.find(item=>item.id===id)?.body,result.note),noteBody);
 await page.evaluate(id=>{lmnWorkspace.openSearchResult({kind:'content',id,contentScope:'global'});const record=lmnWorkspace.state.contentObjects.find(item=>item.id===id);record.objectContent={title:record.title,body:record.body};lmnWorkspace.renderNavigatorObject();},result.note);
 await page.locator('#contentDocumentContent .document-body-editor').fill(noteBody+'\nSynced legacy archive.');
 result.savedArchive=await page.evaluate(id=>{const item=lmnWorkspace.state.contentObjects.find(item=>item.id===id);return{body:item.body,objectBody:item.objectContent.body,owner:item.ownerKnowledgeId??null};},result.note);
 assert.equal(result.savedArchive.body,result.savedArchive.objectBody);assert.equal(result.savedArchive.owner,null);

 await page.getByRole('button',{name:'＋ 结构',exact:true}).click();
 await page.locator('#structureLibrary .template-card').filter({has:page.locator('h3',{hasText:/n.*中心/})}).click();
 assert.ok(await page.locator('#configParameters input,#configParameters select').count());
 assert.ok(await page.locator('#configPreview svg').count());await page.locator('#confirmStructureInsert').click();
 result.structure=await page.evaluate(()=>{const app=lmnWorkspace,instance=app.instance;instance.displayTitle='QA511 未归类结构';instance.objectContent.title=instance.displayTitle;app.scheduleSave('qa:rename');app.renderAll();return{id:instance.id,owner:instance.ownerKnowledgeId};});
 assert.equal(result.structure.owner,null);

 await page.evaluate(()=>lmnWorkspace.openKnowledge('qa511:A'));
 await (await rowFor({kind:'knowledge',id:'qa511:B'})).locator('.nav-location-menu').click();
 await page.locator('#contextMenu').getByRole('button',{name:/更改内容地址/}).click();
 await page.locator('#contentAddressDialog .content-address-option').filter({has:page.locator('b',{hasText:/^QA511 C$/})}).click();
 await page.locator('#contentAddressDialog').getByRole('button',{name:'移动到此处',exact:true}).click();
 result.changedAddress=await page.evaluate(()=>lmnWorkspace.path.map(item=>item.id));assert.deepEqual(result.changedAddress,['qa511:C','qa511:B']);
 await page.screenshot({path:'qa-output/v511-content-address.png'});

 await (await rowFor({kind:'knowledge',id:'qa511:B'})).focus();await page.keyboard.press('Control+x');
 await (await rowFor({kind:'knowledge',id:'qa511:A'})).focus();await page.keyboard.press('Control+v');
 assert.deepEqual(await page.evaluate(()=>lmnWorkspace.path.map(item=>item.id)),['qa511:A','qa511:B']);
 assert.equal(await page.evaluate(()=>lmnWorkspace.contentClipboard),null);
 await (await rowFor({kind:'knowledge',id:'qa511:B'})).focus();await page.keyboard.press('Control+c');
 await (await rowFor({kind:'knowledge',id:'qa511:C'})).focus();await page.keyboard.press('Control+v');
 result.copy=await page.evaluate(()=>lmnWorkspace.knowledge.id);assert.notEqual(result.copy,'qa511:B');
 assert.equal(await page.evaluate(()=>lmnWorkspace.knowledge.content),'Body B');
 await (await rowFor({kind:'knowledge',id:result.copy})).dragTo(await rowFor({kind:'knowledge',id:'qa511:A'}));
 result.dragAddress=await page.evaluate(id=>lmnWorkspace.navigationIndex().pathFor({kind:'knowledge',id}).map(item=>item.id),result.copy);
 assert.deepEqual(result.dragAddress,['qa511:A',result.copy]);

 await page.locator('#homeBtn').click();await page.locator('#navigatorMenu').click();
 await page.locator('#contextMenu').getByRole('button',{name:/批量管理/}).click();
 await page.locator('#batchContentType').selectOption('structure');
 await page.locator('#batchDeleteList .batch-delete-row').filter({hasText:'QA511 未归类结构'}).locator('input').check();
 await page.locator('#batchContentType').selectOption('content');
 await page.locator('#batchDeleteList .batch-delete-row').filter({hasText:'QA511 未归类正文'}).locator('input').check();
 await page.locator('#batchDeletePreview').click();
 assert.match(await page.locator('#dangerBody').innerText(),/结构: 1/);assert.match(await page.locator('#dangerBody').innerText(),/正文: 1/);
 await page.locator('#dangerConfirm').click();
 result.deleted=await page.evaluate(({note,structure})=>({note:!lmnWorkspace.state.contentObjects.some(item=>item.id===note),structure:!lmnWorkspace.state.structureInstances.some(item=>item.id===structure.id),knowledge:lmnWorkspace.state.knowledge.length}),{note:result.note,structure:result.structure});
 assert.deepEqual(result.deleted,{note:true,structure:true,knowledge:4});
 await page.locator('#undoBtn').click();
 result.undo=await page.evaluate(({note,structure})=>({note:lmnWorkspace.state.contentObjects.some(item=>item.id===note),structure:lmnWorkspace.state.structureInstances.some(item=>item.id===structure.id)}),{note:result.note,structure:result.structure});
 assert.deepEqual(result.undo,{note:true,structure:true});

 // Canceling either stage of standalone insertion must not change the owner of
 // the next ordinary insertion under an existing Knowledge.
 await page.getByRole('button',{name:'＋ 结构',exact:true}).click();await page.locator('#structureLibrary > header .dialog-close').click();
 await page.waitForFunction(()=>!lmnWorkspace.standaloneStructureInsert);
 await page.getByRole('button',{name:'＋ 结构',exact:true}).click();await page.locator('#structureLibrary .template-card').filter({has:page.locator('h3',{hasText:/n.*中心/})}).click();
 await page.locator('#structureConfigDialog footer .dialog-close').click();await page.waitForFunction(()=>!lmnWorkspace.standaloneStructureInsert);
 await page.evaluate(()=>{lmnWorkspace.openKnowledge('qa511:A');lmnWorkspace.openLibrary();});
 await page.locator('#structureLibrary .template-card').filter({has:page.locator('h3',{hasText:/n.*中心/})}).click();await page.locator('#confirmStructureInsert').click();
 result.ownedAfterCancel=await page.evaluate(()=>({id:lmnWorkspace.instance.id,owner:lmnWorkspace.instance.ownerKnowledgeId}));assert.equal(result.ownedAfterCancel.owner,'qa511:A');
 result.clipboardGuard=await page.evaluate(id=>{const app=lmnWorkspace;app.setContentClipboard('copy',[{kind:'knowledge',id:'qa511:B'}]);const before=JSON.stringify(app.contentClipboard),slot=app.contentEntries().find(entry=>entry.kind==='slot'&&entry.instanceId===id),accepted=app.setContentClipboard('copy',[slot.target]);return{accepted,preserved:JSON.stringify(app.contentClipboard)===before};},result.ownedAfterCancel.id);
 assert.deepEqual(result.clipboardGuard,{accepted:false,preserved:true});
 result.movedTabs=await page.evaluate(async id=>{
  const app=lmnWorkspace,{addContainerContent}=await import(new URL('../../packages/domain/semantic-container.js',location.href)),instance=app.state.structureInstances.find(item=>item.id===id),slotId=Object.keys(instance.containers)[0];
  addContainerContent(instance,slotId,{id:'qa511:local-edit',type:'content',content:{title:'QA511 局部正文',body:'Keep this text'},metadata:{placementMode:'construct'}});
  app.openInstance(id);app.openContentDocument(slotId,'qa511:local-edit');
  const moved=app.performContentOperation('move',[{kind:'structure',id}],{kind:'knowledge',id:'qa511:C'});
  const tabs=app.openTabs.filter(tab=>{const route=app.documentRoute(tab.id);return route.valid&&route.parts[0]===id;});
  const snapshot={moved:!!moved,count:tabs.length,unique:new Set(tabs.map(tab=>tab.id)).size===tabs.length,owners:tabs.every(tab=>tab.knowledgeId==='qa511:C'),histories:tabs.every(tab=>(tab.history??[]).every(location=>location.knowledgeId==='qa511:C'&&location.path[0]?.id==='qa511:C'))};
  app.openContentDocument(slotId,'qa511:local-edit');app.performContentOperation('delete',[{kind:'content',id:'qa511:local-edit',instanceId:id,slotId}]);
  snapshot.deletedTabGone=!app.openTabs.some(tab=>app.documentRoute(tab.id).parts?.[2]==='qa511:local-edit');snapshot.remainingTabsValid=app.openTabs.every(tab=>app.validOpenTab(tab));
  return snapshot;
 },result.ownedAfterCancel.id);
 assert.equal(result.movedTabs.moved,true);assert.ok(result.movedTabs.count>=2);assert.equal(result.movedTabs.unique,true);assert.equal(result.movedTabs.owners,true);assert.equal(result.movedTabs.histories,true);assert.equal(result.movedTabs.deletedTabGone,true);assert.equal(result.movedTabs.remainingTabsValid,true);

 await page.evaluate(()=>lmnWorkspace.openGlobalSettings());await page.locator('[data-global-pref=language]').selectOption('en');
 await page.waitForFunction(()=>document.documentElement.lang==='en');
 assert.match(await page.locator('[data-navigator=outline] small').innerText(),/^Content library$/i);assert.match(await page.locator('#navigatorTitle').innerText(),/^Content library$/i);
 assert.equal(await page.getByRole('button',{name:'＋ Note',exact:true}).count(),1);
 await page.locator('#navigatorMenu').click();result.englishMenu=await page.locator('#contextMenu').innerText();assert.doesNotMatch(result.englishMenu,/[\u3400-\u9fff]/);
 await page.locator('#contextMenu').getByRole('button',{name:/Manage \/ delete/}).click();
 assert.equal(await page.locator('#batchContentType option[value=unassigned]').textContent(),'Unassigned only');
 await page.locator('#batchContentType').selectOption('unassigned');assert.equal(await page.locator('#batchDeleteList .batch-delete-row').filter({hasText:'QA511 未归类正文'}).count(),1);assert.equal(await page.locator('#batchDeleteList .batch-delete-row').filter({hasText:'QA511 A'}).count(),0);
 await page.screenshot({path:'qa-output/v511-content-en.png'});
 assert.deepEqual(errors,[]);result.errors=errors;await writeFile('qa-output/v511-content-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){await page.screenshot({path:'qa-output/v511-content-failure.png'});console.error(JSON.stringify({errors,state:await page.evaluate(()=>({document:globalThis.lmnWorkspace?.document,status:document.querySelector('#saveStatus')?.textContent,dialogs:[...document.querySelectorAll('dialog[open]')].map(item=>item.id)}))},null,2));throw error;}
finally{await browser.close();}
