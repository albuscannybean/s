import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/magni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),context=await browser.newContext({viewport:{width:900,height:760},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.stack||error.message));
page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('favicon'))errors.push(message.text())});
await page.goto(process.env.LMN_QA_URL??'http://127.0.0.1:4174/apps/web/',{waitUntil:'networkidle'});
await page.evaluate(()=>new Promise(resolve=>{localStorage.clear();const request=indexedDB.deleteDatabase('lmn-knowledge-system');request.onsuccess=resolve;request.onerror=resolve;request.onblocked=resolve}));
await page.reload({waitUntil:'networkidle'});try{await page.waitForFunction(()=>!!globalThis.lmnWorkspace,{timeout:10000})}catch(error){console.error(JSON.stringify({errors,status:await page.locator('#runtimeStatus').textContent(),url:page.url()},null,2));throw error}

await page.evaluate(async()=>{
  const[{createKnowledge},{addContainerContent},{bindTarget,createStructureInstance,materializeInstanceDefinition}]=await Promise.all([import('/packages/domain/core.js'),import('/packages/domain/semantic-container.js'),import('/packages/structure-engine/model.js')]),app=lmnWorkspace,root=createKnowledge('hello'),child=createKnowledge('nested knowledge'),template=app.state.structureTemplates.find(item=>item.id==='builtin:lmn-432'),instance=createStructureInstance(template,root.id),definition=materializeInstanceDefinition(template,instance);
  app.state.knowledge.push(root,child);app.state.structureInstances.push(instance);bindTarget(instance,template,'L1','knowledge',root.id,{placementMode:'construct'});bindTarget(instance,template,'L2','knowledge',child.id,{placementMode:'construct'});addContainerContent(instance,'L1',{type:'content',content:{title:'yes',body:'online-shaped data',contentType:'note'}},definition);app.currentKnowledgeId=root.id;app.openInstance(instance.id,false);app.navExpanded().add(`structure:${instance.id}`);app.navExpanded().add(`structure:${instance.id}:slot:L1`);app.openContainer('L1');app.renderNavigator();
});
await page.waitForTimeout(120);

const result={errors,groups:await page.locator('#navigatorContent>.nav-group').count(),groupTitles:await page.locator('#navigatorContent>.nav-group>.nav-group-title span').allTextContents(),activeStructures:await page.locator('#navigatorContent .nav-structure-row.active').count(),structureRows:await page.locator('#navigatorContent .nav-structure-row').count(),text:await page.locator('#navigatorContent').innerText(),locatedFallback:await page.locator('#navigatorContent>.nav-group').filter({hasText:'当前位置'}).count()};
console.log(JSON.stringify(result,null,2));
if(errors.length||result.groups!==1||result.groupTitles[0]!=='hello'||result.activeStructures<1||result.structureRows<2||!result.text.includes('nested knowledge')||!result.text.includes('yes')||result.locatedFallback!==0)process.exitCode=1;
await browser.close();
