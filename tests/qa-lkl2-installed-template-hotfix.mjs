import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/magni/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),context=await browser.newContext({viewport:{width:1280,height:840},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.stack||error.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('favicon'))errors.push(message.text())});
await page.goto(process.env.LMN_QA_URL??'http://127.0.0.1:4174/apps/web/',{waitUntil:'domcontentloaded'});try{await page.waitForFunction(()=>!!globalThis.lmnWorkspace,{timeout:10000})}catch(error){console.error(JSON.stringify({errors,body:await page.locator('body').innerText()},null,2));await browser.close();process.exit(1)}

const imported=await page.evaluate(async()=>{
  const moduleUrl=path=>new URL(`../../${path}`,location.href).href,[{importLkl},{buildImportPlan,commitImportPlan,importKnowledgePackage},{materializeInstanceDefinition}]=await Promise.all([import(moduleUrl('packages/lkl/index.js')),import(moduleUrl('packages/lkl2/index.js')),import(moduleUrl('packages/structure-engine/model.js'))]),app=lmnWorkspace;
  const lkl1=`lkl 1
structure custom:german-idealism-four-axis "德国观念论四哲学家主轴"
layout manual
slot kant "康德" philosopher many knowledge,structure {"order":0}
slot fichte "费希特" philosopher many knowledge,structure {"order":1}
slot schelling "谢林" philosopher many knowledge,structure {"order":2}
slot hegel "黑格尔" philosopher many knowledge,structure {"order":3}
end`,installed=importLkl(lkl1).definition;
  app.state.structureTemplates.push(installed);
  const source=`lkl 2
package pkg:german-idealism {
 title "德国观念论"
 version "1.0"
 root knowledge german-idealism
}
knowledge german-idealism { title "德国观念论" }
structure-instance german-idealism-axis {
 using custom:german-idealism-four-axis
 owner german-idealism
 title "康德—费希特—谢林—黑格尔主轴"
}
placement axis-placement {
 target structure german-idealism-axis
 parent knowledge german-idealism
 mode construct
 order 0
}`;
  const parsed=importKnowledgePackage(source,{templates:app.state.structureTemplates}),plan=buildImportPlan(parsed.package,app.state);app.state=await commitImportPlan(plan);const instance=app.state.structureInstances.find(item=>item.stableId==='german-idealism-axis'),template=app.state.structureTemplates.find(item=>item.id===instance.templateId),root=app.state.knowledge.find(item=>item.stableId==='german-idealism');app.currentKnowledgeId=root.id;app.openInstance(instance.id,false);app.renderAll();return{valid:parsed.valid,committable:plan.committable,templateId:instance.templateId,title:instance.displayTitle,slots:materializeInstanceDefinition(template,instance).slots.map(item=>item.label)};
});
await page.waitForTimeout(250);const ui={navigator:await page.locator('#navigatorContent').innerText(),nodes:await page.locator('#nodeLayer .scene-node').count(),heading:await page.locator('#workspaceTitle').textContent().catch(()=>null)};
const result={errors,imported,ui};console.log(JSON.stringify(result,null,2));
const ok=!errors.length&&imported.valid&&imported.committable&&imported.templateId==='custom:german-idealism-four-axis'&&imported.title==='康德—费希特—谢林—黑格尔主轴'&&imported.slots.join('|')==='康德|费希特|谢林|黑格尔'&&ui.nodes===4&&ui.navigator.includes('康德—费希特—谢林—黑格尔主轴')&&!ui.navigator.includes('Structure 0');if(!ok)process.exitCode=1;await browser.close();
