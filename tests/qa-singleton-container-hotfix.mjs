import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/magni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),context=await browser.newContext({viewport:{width:1180,height:820},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.stack||error.message));
page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('favicon'))errors.push(message.text())});
await page.goto(process.env.LMN_QA_URL??'http://127.0.0.1:43129/apps/web/',{waitUntil:'networkidle'});
await page.evaluate(()=>new Promise(resolve=>{localStorage.clear();const request=indexedDB.deleteDatabase('lmn-knowledge-system');request.onsuccess=resolve;request.onerror=resolve;request.onblocked=resolve}));
await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!globalThis.lmnWorkspace,{timeout:10000});

await page.evaluate(async()=>{
  const packageRoot=location.pathname.replace(/\/apps\/web\/.*$/,''),modulePath=path=>`${packageRoot}${path}`,[{createKnowledge},{bindTarget,createStructureInstance},{setLocalDisplayTitle}]=await Promise.all([import(modulePath('/packages/domain/core.js')),import(modulePath('/packages/structure-engine/model.js')),import(modulePath('/packages/domain/identity.js'))]),app=lmnWorkspace,root=createKnowledge('康德'),child=createKnowledge('知识与自由的双重批判问题'),template=app.state.structureTemplates.find(item=>item.id==='builtin:dependency-dag'),instance=createStructureInstance(template,root.id);
  instance.displayTitle='思想发生结构';setLocalDisplayTitle(instance,'dependency-dag-1','起始问题');bindTarget(instance,template,'dependency-dag-1','knowledge',child.id,{placementMode:'construct'});app.state.knowledge.push(root,child);app.state.structureInstances.push(instance);app.currentKnowledgeId=root.id;app.openKnowledge(root.id,false);app.openInstance(instance.id,true);app.navExpanded().add(`structure:${instance.id}`);app.navExpanded().add(`structure:${instance.id}:slot:dependency-dag-1`);app.renderNavigator();globalThis.__singletonQa={rootId:root.id,childId:child.id,instanceId:instance.id,slotId:'dependency-dag-1'};
});
await page.waitForTimeout(180);

const node=page.locator('#nodeLayer .scene-node[data-slot-id="dependency-dag-1"]'),presentation={label:await node.locator('.node-label').innerText(),semantic:await node.locator('.node-semantic-title').innerText(),identity:await node.locator('.node-identity').innerText(),mode:await node.getAttribute('data-presentation-mode')};
await node.click({button:'right'});const contextMenu=await page.locator('#contextMenu').innerText();await page.locator('#contextMenu button').filter({hasText:'打开容器'}).click();await page.waitForFunction(()=>lmnWorkspace.document.startsWith('container:'));const forcedDocument=await page.evaluate(()=>lmnWorkspace.document);await page.goBack();await page.waitForFunction(()=>lmnWorkspace.document.startsWith('structure:'));

await node.click();await page.waitForFunction(()=>lmnWorkspace.currentKnowledgeId===__singletonQa.childId);const mouse=await page.evaluate(()=>({document:lmnWorkspace.document,path:lmnWorkspace.path.map(item=>item.label),knowledgeId:lmnWorkspace.currentKnowledgeId}));await page.goBack();await page.waitForFunction(()=>lmnWorkspace.document.startsWith('structure:'));

await node.focus();await node.press('Enter');await page.waitForFunction(()=>lmnWorkspace.currentKnowledgeId===__singletonQa.childId);const keyboard=await page.evaluate(()=>({document:lmnWorkspace.document,path:lmnWorkspace.path.map(item=>item.label)}));await page.goBack();await page.waitForFunction(()=>lmnWorkspace.document.startsWith('structure:'));

const navigatorSlot=page.locator('#navigatorContent .nav-slot-branch .nav-structure-open').filter({hasText:'起始问题'}).first();await navigatorSlot.click();await page.waitForFunction(()=>lmnWorkspace.currentKnowledgeId===__singletonQa.childId);const navigator=await page.evaluate(()=>({document:lmnWorkspace.document,path:lmnWorkspace.path.map(item=>item.label)}));

const result={errors,presentation,contextMenu,forcedDocument,mouse,keyboard,navigator};console.log(JSON.stringify(result,null,2));
const validPath=value=>value.path.includes('思想发生结构')&&value.path.includes('起始问题')&&value.path.includes('知识与自由的双重批判问题');
if(errors.length||presentation.label!=='知识与自由的双重批判问题'||presentation.semantic!=='起始问题 · 知识'||presentation.identity==='dependency-dag-1'||presentation.mode!=='singleton'||!contextMenu.includes('打开容器')||!forcedDocument.startsWith('container:')||mouse.document!=='notes'||keyboard.document!=='notes'||navigator.document!=='notes'||!validPath(mouse)||!validPath(keyboard)||!validPath(navigator))process.exitCode=1;
await browser.close();
