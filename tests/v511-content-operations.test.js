import test from 'node:test';
import assert from 'node:assert/strict';
import {listContentEntries,listContentDestinations,prepareContentOperation} from '../packages/navigation/content-operations.js';
import {buildNavigatorIndex} from '../packages/navigation/location-index.js';
import {createStructureInstance,bindTarget} from '../packages/structure-engine/model.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {createContainerContentItem} from '../packages/domain/semantic-container.js';
import {exportStateKnowledgePackage,serializeKnowledgePackage,importKnowledgePackage,buildImportPlan} from '../packages/lkl2/index.js';

const graph=BUILTIN_TEMPLATES.find(template=>template.id==='builtin:directed-graph');
function fixture(){
  const parent={id:'A',title:'A'},child={id:'B',title:'B',content:'Keep literal B in the proof.',packageId:'original-package',stableId:'source-B'},destination={id:'C',title:'C'},external={id:'E',title:'External'};
  const outer=createStructureInstance(graph,'A'),nested=createStructureInstance(graph,'B'),reference=createStructureInstance(graph,'C');
  outer.id='outer';nested.id='nested';reference.id='reference';
  bindTarget(outer,graph,'A','knowledge','B',{placementMode:'construct'});
  bindTarget(reference,graph,'A','knowledge','B',{placementMode:'reference'});
  bindTarget(nested,graph,'A','knowledge','E',{placementMode:'reference'});
  nested.containers.B.children.push(createContainerContentItem('content',{id:'local-body',content:{title:'A local note',body:'![image](data:image/png;base64,YWJj)\nLiteral nested and B'},metadata:{placementMode:'construct'}}));
  return {knowledge:[parent,child,destination,external],structureTemplates:structuredClone(BUILTIN_TEMPLATES),structureInstances:[outer,nested,reference],relations:[{id:'relation-B-E',sourceId:'B',targetId:'E',type:'supports'}],placements:[{id:'pB',targetType:'knowledge',targetId:'B',parentType:'structure',parentId:'outer',path:'A',mode:'construct'}],contentObjects:[{id:'orphan-text',title:'Standalone note',body:'Independent content'}],boards:[{id:'orphan-board',title:'Standalone board',frames:[]}],knowledgePackages:[],representations:[],structureViews:[]};
}

test('content inventory includes unattached structures, notes and boards with explicit capabilities',()=>{
  const state=fixture(),orphan=createStructureInstance(graph);orphan.id='orphan-structure';state.structureInstances.push(orphan);
  const before=JSON.stringify(state),entries=listContentEntries(state);
  for(const id of ['orphan-text','orphan-board','orphan-structure']){const entry=entries.find(item=>item.id===id);assert.ok(entry);assert.equal(entry.unassigned,true);assert.equal(entry.capabilities.delete,true);}
  assert.equal(entries.find(item=>item.kind==='knowledge'&&item.id==='A').unassigned,false);
  assert.equal(entries.find(item=>item.kind==='slot').capabilities.move,false);
  assert.equal(JSON.stringify(state),before);
});

test('moving Knowledge changes its canonical address without deleting external references or children',()=>{
  const state=fixture(),before=JSON.stringify(state),result=prepareContentOperation(state,{operation:'move',targets:[{kind:'knowledge',id:'B'}],destination:{kind:'knowledge',id:'C'}}),index=buildNavigatorIndex(result.state);
  assert.deepEqual(index.pathFor({kind:'knowledge',id:'B'}).map(item=>item.id),['C','B']);
  assert.equal(result.state.structureInstances.find(item=>item.id==='outer').bindings.length,0);
  assert.equal(result.state.structureInstances.find(item=>item.id==='reference').bindings[0].targetId,'B');
  assert.equal(result.state.structureInstances.find(item=>item.id==='nested').ownerKnowledgeId,'B');
  assert.equal(result.state.knowledge.find(item=>item.id==='B').packageId,'original-package');
  assert.equal(result.state.relations.length,1);assert.equal(JSON.stringify(state),before);
});

test('cycle and occupied cardinality errors leave the complete input state unchanged',()=>{
  const state=fixture(),before=JSON.stringify(state);
  assert.throws(()=>prepareContentOperation(state,{operation:'move',targets:[{kind:'knowledge',id:'A'}],destination:{kind:'slot',instanceId:'nested',slotId:'B'}}),error=>error.code==='ownership-cycle');
  const custom={id:'one-slot',name:'One',slots:[{id:'only',label:'Only',accepts:['knowledge','structure'],cardinality:'one'}],edges:[],parameters:[],layout:{type:'grid'}};
  state.structureTemplates.push(custom);const instance=createStructureInstance(custom,'C');instance.id='one';bindTarget(instance,custom,'only','knowledge','E',{placementMode:'reference'});state.structureInstances.push(instance);
  const withSingle=JSON.stringify(state);
  assert.throws(()=>prepareContentOperation(state,{operation:'move',targets:[{kind:'knowledge',id:'B'}],destination:{kind:'slot',instanceId:'one',slotId:'only'}}),error=>error.code==='occupied-destination');
  assert.equal(JSON.stringify(state),withSingle);assert.equal(before.includes('one-slot'),false);
});

test('deep copy remaps owned entities and bindings, preserves outside references and authored text',()=>{
  const state=fixture();
  const result=prepareContentOperation(state,{operation:'copy',targets:[{kind:'knowledge',id:'B'},{kind:'structure',id:'nested'}],destination:{kind:'knowledge',id:'C'}});
  assert.equal(result.targets.length,1);assert.equal(result.summary.requested,1);
  const copyId=result.targets[0].id,copy=result.state.knowledge.find(item=>item.id===copyId),nested=result.state.structureInstances.find(item=>item.ownerKnowledgeId===copyId);
  assert.notEqual(copyId,'B');assert.equal(copy.content,'Keep literal B in the proof.');assert.equal(copy.packageId,undefined);assert.equal(copy.stableId,undefined);assert.equal(copy.metadata.copiedFrom.id,'B');
  assert.notEqual(nested.id,'nested');assert.equal(nested.bindings[0].targetId,'E');assert.equal(nested.bindings[0].instanceId,nested.id);
  assert.notEqual(nested.bindings[0].id,state.structureInstances.find(item=>item.id==='nested').bindings[0].id);
  assert.notEqual(nested.containers.B.children[0].id,'local-body');assert.equal(nested.containers.B.children[0].content.body,'![image](data:image/png;base64,YWJj)\nLiteral nested and B');
  assert.ok(result.state.relations.some(item=>item.sourceId===copyId&&item.targetId==='E'));
  assert.deepEqual(buildNavigatorIndex(result.state).pathFor({kind:'knowledge',id:copyId}).map(item=>item.id),['C',copyId]);
  assert.equal(state.knowledge.length,4);
});

test('local text can move to the library root and then into a Knowledge without losing images',()=>{
  const state=fixture(),result=prepareContentOperation(state,{operation:'move',targets:[{kind:'content',id:'local-body',instanceId:'nested',slotId:'B'}],destination:{kind:'root'}}),target=result.targets[0],archive=result.state.contentObjects.find(item=>item.id===target.id);
  assert.equal(target.contentScope,'global');assert.equal(archive.ownerKnowledgeId,null);assert.match(archive.body,/data:image\/png/);
  assert.equal(result.state.structureInstances.find(item=>item.id==='nested').containers.B.children.length,0);
  const moved=prepareContentOperation(result.state,{operation:'move',targets:[target],destination:{kind:'knowledge',id:'C'}});
  assert.deepEqual(buildNavigatorIndex(moved.state).pathFor(target).map(item=>item.id),['C',target.id]);
  const placed=prepareContentOperation(moved.state,{operation:'move',targets:[target],destination:{kind:'slot',instanceId:'outer',slotId:'B'}});
  assert.equal(placed.targets[0].instanceId,'outer');assert.equal(placed.targets[0].slotId,'B');
  assert.match(placed.state.structureInstances.find(item=>item.id==='outer').containers.B.children[0].content.body,/data:image\/png/);
});

test('moving a Knowledge body promotes its text while retaining the Knowledge and descendants',()=>{
  const state=fixture(),result=prepareContentOperation(state,{operation:'move',targets:[{kind:'note',id:'B',contentScope:'knowledge'}],destination:{kind:'root'}});
  assert.equal(result.state.knowledge.find(item=>item.id==='B').content,'');
  assert.equal(result.state.contentObjects.find(item=>item.id===result.targets[0].id).body,'Keep literal B in the proof.');
  assert.ok(result.state.structureInstances.some(item=>item.id==='nested'));
});

test('multi-type deletion removes owned descendants and dangling links while preserving referenced entities',()=>{
  const state=fixture(),before=JSON.stringify(state),result=prepareContentOperation(state,{operation:'delete',targets:[{kind:'knowledge',id:'B'},{kind:'content',id:'orphan-text',contentScope:'global'},{kind:'board',id:'orphan-board'}]});
  assert.equal(result.state.knowledge.some(item=>item.id==='B'),false);assert.equal(result.state.structureInstances.some(item=>item.id==='nested'),false);
  assert.ok(result.state.knowledge.some(item=>item.id==='E'));assert.ok(result.state.structureInstances.some(item=>item.id==='outer'));
  assert.equal(result.state.structureInstances.find(item=>item.id==='reference').bindings.length,0);
  assert.equal(result.state.contentObjects.length,0);assert.equal(result.state.boards.length,0);assert.equal(result.state.relations.length,0);
  assert.equal(result.summary.counts.knowledge,1);assert.equal(result.summary.counts.structures,1);assert.equal(result.summary.counts.content,1);assert.equal(result.summary.counts.boards,1);
  assert.equal(JSON.stringify(state),before);
});

test('copying a subtree includes archived local content and remaps every backing target',()=>{
  const state=fixture(),nested=state.structureInstances.find(item=>item.id==='nested');
  state.contentObjects.push({id:'shared-archive',title:'Archived proof',body:'Exact proof',ownerKnowledgeId:'B'});
  nested.containers.C.children.push(createContainerContentItem('content',{id:'archive-item',targetId:'shared-archive',content:{title:'Archived proof',body:'Exact proof'}}));
  const result=prepareContentOperation(state,{operation:'copy',targets:[{kind:'knowledge',id:'B'}],destination:{kind:'root'}}),copiedKnowledge=result.targets[0].id,copiedStructure=result.state.structureInstances.find(item=>item.ownerKnowledgeId===copiedKnowledge),item=copiedStructure.containers.C.children[0];
  assert.notEqual(item.targetId,'shared-archive');assert.ok(result.state.contentObjects.some(content=>content.id===item.targetId&&content.body==='Exact proof'));
  assert.equal(result.state.contentObjects.find(content=>content.id===item.targetId).ownerKnowledgeId,copiedKnowledge);
});

test('deleting a backed construct content removes its archive and dependent appearances once',()=>{
  const state=fixture(),nested=state.structureInstances.find(item=>item.id==='nested');
  state.contentObjects.push({id:'archive',title:'Archive',body:'Text'});
  nested.containers.C.children.push(createContainerContentItem('content',{id:'archive-item',targetId:'archive',content:{body:'Text'}}));
  const result=prepareContentOperation(state,{operation:'delete',targets:[{kind:'content',id:'archive-item',instanceId:'nested',slotId:'C'}]});
  assert.equal(result.state.contentObjects.some(item=>item.id==='archive'),false);assert.equal(result.summary.affected,1);
  assert.equal(result.state.structureInstances.find(item=>item.id==='nested').containers.C.children.length,0);
});

test('generated canonical relations cannot be destroyed by the batch content interface',()=>{
  const state=fixture(),template=state.structureTemplates.find(item=>item.id==='builtin:boolean-algebra'),instance=createStructureInstance(template);instance.id='boolean';state.structureInstances.push(instance);
  const entry=listContentEntries(state).find(item=>item.kind==='relation'&&item.instanceId==='boolean');assert.equal(entry.capabilities.delete,false);
  assert.throws(()=>prepareContentOperation(state,{operation:'delete',targets:[entry.target]}),error=>error.code==='unsupported-operation');
});

test('the address picker omits descendants and English failures remain understandable',()=>{
  const state=fixture(),targets=[{kind:'knowledge',id:'B'}],destinations=listContentDestinations(state,{targets,operation:'move',language:'en'});
  assert.equal(destinations[0].label,'Content Library');assert.ok(destinations.some(item=>item.kind==='knowledge'&&item.id==='C'));
  assert.equal(destinations.some(item=>item.instanceId==='nested'),false);
  assert.throws(()=>prepareContentOperation(state,{operation:'move',targets,destination:{kind:'slot',instanceId:'nested',slotId:'B'},language:'en'}),error=>error.code==='ownership-cycle'&&!/[\u3400-\u9fff]/.test(error.message));
});

test('direct Knowledge and content addresses survive LKL export and re-import across namespaces',()=>{
  const state=fixture();state.structureInstances=[];state.relations=[];state.placements=[];
  state.knowledge.find(item=>item.id==='B').externalStableId='package-one/knowledge:root';
  state.knowledge.find(item=>item.id==='C').externalStableId='package-two/knowledge:root';
  const moved=prepareContentOperation(state,{operation:'move',targets:[{kind:'knowledge',id:'B'},{kind:'content',id:'orphan-text',contentScope:'global'}],destination:{kind:'knowledge',id:'C'}});
  const exported=exportStateKnowledgePackage(moved.state,{rootKnowledgeId:'C'});
  assert.equal(exported.knowledge.length,2);assert.equal(exported.contents.length,1);
  assert.equal(new Set(exported.knowledge.map(item=>item.stableId)).size,2);
  const parsed=importKnowledgePackage(serializeKnowledgePackage(exported));assert.equal(parsed.valid,true,JSON.stringify(parsed.errors));
  const plan=buildImportPlan(parsed.package,{structureTemplates:BUILTIN_TEMPLATES});assert.equal(plan.committable,true);
  const restored=plan.nextState,index=buildNavigatorIndex(restored),child=restored.knowledge.find(item=>item.title==='B'),note=restored.contentObjects.find(item=>item.title==='Standalone note');
  assert.deepEqual(index.pathFor({kind:'knowledge',id:child.id}).map(item=>item.label),['C','B']);
  assert.deepEqual(index.pathFor({kind:'content',id:note.id,contentScope:'global'}).map(item=>item.label),['C','Standalone note']);
});

test('every built-in structure remains copyable and deletable as an independent library object',()=>{
  for(const template of BUILTIN_TEMPLATES){const instance=createStructureInstance(template),state={knowledge:[],structureTemplates:BUILTIN_TEMPLATES,structureInstances:[instance]},copied=prepareContentOperation(state,{operation:'copy',targets:[{kind:'structure',id:instance.id}],destination:{kind:'root'}});assert.equal(copied.state.structureInstances.length,2,template.id);const removed=prepareContentOperation(copied.state,{operation:'delete',targets:copied.targets});assert.equal(removed.state.structureInstances.length,1,template.id);assert.equal(removed.state.structureInstances[0].id,instance.id);}
});

test('copy, paste, move, delete and export keep the original package and source notes intact',()=>{
  const original=fixture(),packageRecord={id:'package-record',packageId:'original-package',stableId:'original-package',rootKnowledgeId:'A',rootInternalId:'A',root:{type:'knowledge',id:'A'},entries:[{id:'entry-A',stableId:'entry-A',target:{type:'knowledge',id:'A'}}],sources:[{id:'source',title:'User-provided material'}]};
  original.knowledgePackages=[packageRecord];
  const clipboard=[{kind:'knowledge',id:'B'}];
  const pasted=prepareContentOperation(original,{operation:'copy',targets:clipboard,destination:{kind:'knowledge',id:'C'}}),copy=pasted.targets[0];
  const moved=prepareContentOperation(pasted.state,{operation:'move',targets:[copy],destination:{kind:'slot',instanceId:'reference',slotId:'B'}});
  assert.deepEqual(buildNavigatorIndex(moved.state).pathFor(copy).map(item=>item.id),['C','reference','B',copy.id]);
  const copyStructure=moved.state.structureInstances.find(item=>item.ownerKnowledgeId===copy.id),copyNote=copyStructure.containers.B.children[0];
  const edited=prepareContentOperation(moved.state,{operation:'delete',targets:[{kind:'content',id:copyNote.id,instanceId:copyStructure.id,slotId:'B'}]});
  assert.equal(edited.state.structureInstances.find(item=>item.id===copyStructure.id).containers.B.children.length,0);
  const model=exportStateKnowledgePackage(edited.state,{rootKnowledgeId:'C'}),parsed=importKnowledgePackage(serializeKnowledgePackage(model));
  assert.equal(parsed.valid,true,JSON.stringify(parsed.errors));
  const restored=buildImportPlan(parsed.package,{structureTemplates:BUILTIN_TEMPLATES}).nextState;
  assert.ok(restored.placements.some(item=>item.parentType==='structure'&&item.path==='B'&&item.mode==='construct'));
  const deleted=prepareContentOperation(edited.state,{operation:'delete',targets:[copy]});
  assert.equal(deleted.state.knowledge.some(item=>item.id===copy.id),false);
  assert.deepEqual(deleted.state.knowledgePackages,[packageRecord]);
  assert.equal(deleted.state.knowledge.find(item=>item.id==='B').content,original.knowledge.find(item=>item.id==='B').content);
  assert.equal(deleted.state.structureInstances.find(item=>item.id==='nested').containers.B.children[0].content.body,original.structureInstances.find(item=>item.id==='nested').containers.B.children[0].content.body);
  assert.equal(original.knowledge.length,4);
});

test('persistent local entries expose the actual stored record for an undo-aware rename',()=>{
  const state=fixture(),entry=listContentEntries(state).find(item=>item.kind==='content'&&item.id==='local-body'),stored=state.structureInstances.find(item=>item.id==='nested').containers.B.children[0];
  assert.equal(entry.record,stored);assert.equal(entry.item,stored);
});

test('moving a package entry out does not corrupt export of the remaining original package',()=>{
  const state=fixture();state.relations=[];
  state.knowledge.find(item=>item.id==='A').packageId='original-package';
  state.knowledgePackages=[{id:'package-A',stableId:'original-package',packageId:'original-package',rootKnowledgeId:'A',defaultEntry:'child',entries:[{stableId:'start',target:{type:'knowledge',id:'A'}},{stableId:'child',target:{type:'knowledge',id:'source-B'}}]}];
  const moved=prepareContentOperation(state,{operation:'move',targets:[{kind:'knowledge',id:'B'}],destination:{kind:'knowledge',id:'C'}}),model=exportStateKnowledgePackage(moved.state,{rootKnowledgeId:'A'}),parsed=importKnowledgePackage(serializeKnowledgePackage(model));
  assert.equal(parsed.valid,true,JSON.stringify(parsed.errors));assert.equal(model.package.defaultEntry,'start');assert.equal(model.entries.length,1);
  assert.deepEqual(moved.state.knowledgePackages,state.knowledgePackages);
});
