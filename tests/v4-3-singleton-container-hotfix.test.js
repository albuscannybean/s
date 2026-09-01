import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {addContainerContent,buildPositionIndex,containerItemLabel,resolveContainerOpenTarget} from '../packages/domain/semantic-container.js';
import {nodeContainerPresentation,objectQuickPreview,resolveContainerPresentation} from '../packages/structure-engine/presentation-adapters.js';
import {structureSegment} from '../packages/navigation/path.js';

const knowledge={id:'knowledge-critical-freedom',title:'知识与自由的双重批判问题'};

test('singleton Knowledge becomes the primary canvas title while slot semantics remain secondary',()=>{
  const template=getBuiltinTemplate('builtin:dependency-dag'),instance=createStructureInstance(template,'root'),definition=materializeInstanceDefinition(template,instance),slot=definition.slots[0];
  slot.displayLabel='起始问题';
  addContainerContent(instance,slot.id,{type:'knowledge',targetId:knowledge.id},definition);
  const state={knowledge:[knowledge],structureTemplates:[template],structureInstances:[instance]},entry=buildPositionIndex(instance,definition).bySlotId[slot.id],presentation=resolveContainerPresentation(slot,entry,state,{instance}),nodePresentation=nodeContainerPresentation(template,{slot,entry,state,instance,definition}),preview=objectQuickPreview(template,{slot,entry,state,instance,definition});
  assert.equal(presentation.primaryTitle,knowledge.title);
  assert.equal(presentation.secondaryTitle,'起始问题 · 知识');
  assert.equal(presentation.mode,'singleton');
  assert.equal(nodePresentation.primaryTitle,knowledge.title);
  assert.equal(preview.title,knowledge.title);
  assert.doesNotMatch(JSON.stringify({presentation,preview}),/dependency-dag-1/);
});

test('Structure labels prefer instance displayTitle and collection previews resolve referenced titles',()=>{
  const template=getBuiltinTemplate('builtin:dependency-dag'),childTemplate=getBuiltinTemplate('builtin:tree'),instance=createStructureInstance(template,'root'),child=createStructureInstance(childTemplate,'root');
  child.displayTitle='康德：代表著作';
  const state={knowledge:[knowledge],structureTemplates:[template,childTemplate],structureInstances:[instance,child]},structureItem={id:'child-structure',type:'structure',targetId:child.id,persistence:'persistent',content:null},knowledgeItem={id:'child-knowledge',type:'knowledge',targetId:knowledge.id,persistence:'persistent',content:null};
  assert.equal(containerItemLabel(structureItem,state),'康德：代表著作');
  assert.equal(structureSegment(child,childTemplate).label,'康德：代表著作');
  const slot={id:'dependency-dag-1',label:'起始问题',role:'input'},singleton=resolveContainerPresentation(slot,{persistentChildren:[structureItem]},state,{instance});
  assert.equal(singleton.primaryTitle,'康德：代表著作');
  const collection=resolveContainerPresentation(slot,{persistentChildren:[knowledgeItem,structureItem]},state,{instance});
  assert.equal(collection.primaryTitle,'起始问题');
  assert.deepEqual(collection.lines,[knowledge.title,'康德：代表著作']);
});

test('transparent container resolver uses only one persistent direct payload',()=>{
  const structure={id:'child',templateId:'builtin:tree'},state={knowledge:[knowledge],structureInstances:[structure],contentObjects:[]};
  const item=(type,targetId,content=null,persistence='persistent')=>({id:`${type}-${targetId}`,type,targetId,content,persistence});
  assert.equal(resolveContainerOpenTarget({persistentChildren:[]},state).kind,'container');
  assert.equal(resolveContainerOpenTarget({persistentChildren:[item('knowledge',knowledge.id)]},state).kind,'item');
  assert.equal(resolveContainerOpenTarget({persistentChildren:[item('structure',structure.id)]},state).kind,'item');
  assert.equal(resolveContainerOpenTarget({persistentChildren:[item('content','note',{title:'正文'})]},state).kind,'item');
  assert.equal(resolveContainerOpenTarget({persistentChildren:[item('formula','formula',{title:'公式'})]},state).kind,'item');
  assert.equal(resolveContainerOpenTarget({persistentChildren:[item('link','url',{title:'外链'})]},state).kind,'container');
  assert.equal(resolveContainerOpenTarget({persistentChildren:[item('knowledge',knowledge.id),item('content','note',{title:'正文'})]},state).kind,'container');
  assert.equal(resolveContainerOpenTarget({children:[item('knowledge',knowledge.id),item('variable','runtime',null,'runtime')]},state).kind,'item');
});

test('Workspace openSlot is the shared Canvas and Navigator resolver with an explicit forced Container route',async()=>{
  globalThis.localStorage??={getItem:()=>null,setItem:()=>{}};
  const {WorkspaceController}=await import('../packages/ui/workspace-controller.js'),template=getBuiltinTemplate('builtin:dependency-dag'),instance=createStructureInstance(template,'root'),slot=materializeInstanceDefinition(template,instance).slots[0],controller=new WorkspaceController(),calls=[];
  addContainerContent(instance,slot.id,{type:'knowledge',targetId:knowledge.id},materializeInstanceDefinition(template,instance));
  controller.state={...controller.state,knowledge:[knowledge],structureTemplates:[template],structureInstances:[instance]};controller.currentInstanceId=instance.id;controller.openContainerItem=(slotId,value)=>calls.push(['item',slotId,value.type]);controller.openContainer=slotId=>calls.push(['container',slotId]);
  controller.openSlot(slot.id);controller.openSlot(slot.id,{forceContainer:true});
  assert.deepEqual(calls,[['item',slot.id,'knowledge'],['container',slot.id]]);
  const [source,renderer]=await Promise.all([readFile(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),readFile(new URL('../packages/ui/structure-renderer.js',import.meta.url),'utf8')]);
  assert.match(source,/onOpenContainer:[^\n]+this\.openSlot\(/);
  assert.match(source,/open\.onclick=\(\)=>\{this\.openInstance\(instance\.id,false\);this\.openSlot\(slot\.id\)\}/);
  assert.match(source,/label:'打开容器'[^\n]+forceContainer:true/);
  assert.match(renderer,/article\.addEventListener\('click'[^\n]+onOpenContainer/);
  assert.match(renderer,/event\.key==='Enter'\|\|event\.key===' '[^\n]+onOpenContainer/);
});

test('special mathematical presentation remains semantic and deployment cache advances without changing product version',async()=>{
  const matrix=getBuiltinTemplate('builtin:matrix-grid'),instance=createStructureInstance(matrix,'root'),definition=materializeInstanceDefinition(matrix,instance),slot=definition.slots[0],entry=buildPositionIndex(instance,definition).bySlotId[slot.id];
  assert.equal(nodeContainerPresentation(matrix,{slot,entry,state:{},instance,definition}),null);
  const [serviceWorker,metadata]=await Promise.all([readFile(new URL('../apps/web/sw.js',import.meta.url),'utf8'),readFile(new URL('../packages/app-metadata.js',import.meta.url),'utf8')]);
  assert.match(serviceWorker,/lmn-v4\.3\.0-stable-20260902-7/);
  assert.match(metadata,/V4\.3\.0/);
});
