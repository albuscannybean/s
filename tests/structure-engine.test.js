import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_TEMPLATES,getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {bindTarget,createStructureInstance,nestedStructureCycle,validateInstance,validateTemplate} from '../packages/structure-engine/model.js';
import {evaluateExpression,evaluateRules,runInstance} from '../packages/structure-engine/evaluator.js';
import {migrateV2ToV3,validateV3Bundle} from '../packages/structure-engine/migration.js';
import {exportV3Bundle,importV3Bundle} from '../packages/structure-engine/bundle.js';
import {patternSearch,structureSearch} from '../packages/search-engine/search.js';
import {createKnowledge} from '../packages/domain/core.js';

test('all built-in templates have a valid formal schema',()=>{
  for(const template of BUILTIN_TEMPLATES)assert.deepEqual(validateTemplate(template),{valid:true,errors:[]},template.name);
});

test('regular n-gon materializes vertices, polygon sides, and semantic order',()=>{
  const polygon=materializeTemplate(getBuiltinTemplate('builtin:regular-polygon'),{n:7});
  assert.equal(polygon.slots.length,7);assert.equal(polygon.edges.length,7);assert.equal(polygon.slots[6].semanticCoordinate.polygonOrder,6);assert.equal(polygon.edges[6].targetSlotId,'v0');
});

test('cyclic group and Cayley operation table preserve algebraic semantics',()=>{
  const group=materializeTemplate(getBuiltinTemplate('builtin:cyclic-group'),{n:6,generator:5});assert.equal(group.edges.find(edge=>edge.sourceSlotId==='g0').targetSlotId,'g5');
  const table=materializeTemplate(getBuiltinTemplate('builtin:operation-table'),{n:4,operation:'multiply-mod-n'});assert.equal(table.slots.find(slot=>slot.id==='cell-3-3').semanticCoordinate.value,1);
});

test('Knowledge creation has no Structure side effect and binding is explicit',()=>{
  const knowledge=createKnowledge('Independent'),template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template,knowledge.id);
  assert.equal(instance.bindings.length,0);bindTarget(instance,template,'L1','knowledge',knowledge.id);assert.equal(instance.bindings[0].targetId,knowledge.id);assert.equal(validateInstance(instance,BUILTIN_TEMPLATES,[instance],[knowledge]).valid,true);
});

test('nested heterogeneous Structures reject recursive cycles',()=>{
  const a=createStructureInstance(getBuiltinTemplate('builtin:lmn-432')),b=createStructureInstance(getBuiltinTemplate('builtin:tree'));
  bindTarget(a,getBuiltinTemplate('builtin:lmn-432'),'L1','structure',b.id);assert.equal(nestedStructureCycle([a,b],b.id,a.id),true);assert.equal(nestedStructureCycle([a,b],a.id,b.id),false);
});

test('safe evaluator supports dependency ordering and blocks illegal operations',()=>{
  const result=evaluateRules([{target:'B',expression:{op:'add',args:[{var:'A'},{value:5}]}},{target:'C',expression:{op:'multiply',args:[{var:'B'},{value:2}]}}],{A:3});
  assert.deepEqual(result.results,{B:8,C:16});assert.throws(()=>evaluateExpression({op:'eval',args:[{value:'2+2'}]}),/illegal operation/);
});

test('dependency cycles become runtime errors instead of executing arbitrary code',()=>{
  const result=evaluateRules([{target:'A',expression:{var:'B'}},{target:'B',expression:{var:'A'}}],{});assert.equal(result.errors.A,'cyclic dependency');assert.equal(result.errors.B,'cyclic dependency');
});

test('Zi Wei Mod-12 acceptance scenario safely derives Wen Chang and Wen Qu',()=>{
  const template=getBuiltinTemplate('builtin:mod-12'),instance=createStructureInstance(template);let result=runInstance(instance,template);assert.equal(instance.parameters.hour,7);assert.equal(result.results.wenchang,3);assert.equal(result.results.wenqu,11);instance.parameters.hour=5;result=runInstance(instance,template);assert.equal(result.results.wenchang,5);assert.equal(result.results.wenqu,9);
});

test('Hasse structural rule computes a transitive reduction without expression errors',()=>{
  const template=getBuiltinTemplate('builtin:poset-hasse'),instance=createStructureInstance(template),result=runInstance(instance,template);assert.deepEqual(result.errors,{});assert.equal(result.results.transitiveReduction.length,4);
});

test('structure and pattern search use real slot/edge semantics',()=>{
  const lmn=createStructureInstance(getBuiltinTemplate('builtin:lmn-432')),mod=createStructureInstance(getBuiltinTemplate('builtin:mod-12')),state={knowledge:[],relations:[],structureTemplates:BUILTIN_TEMPLATES,structureInstances:[lmn,mod]};
  assert.deepEqual(structureSearch({role:'existence'},state).map(hit=>hit.id),[lmn.id]);assert.deepEqual(structureSearch({modularIndex:4},state).map(hit=>hit.id),[mod.id]);assert.equal(patternSearch({relationType:'defines',sourceRole:'essence',targetRole:'definition'},state)[0].instanceId,lmn.id);
});

test('Scenario F matches Sartre Existence precedes Essence but not a different relation',()=>{
  const sartre=createKnowledge('Sartre'),god=createKnowledge('God'),base={version:1,category:'custom',builtin:false,nestable:true,computable:false,parameters:[],constraints:[],rules:[],layout:{type:'manual'},visual:{accent:'#596b63'},slots:[{id:'existence',label:'Existence',role:'existence',semanticCoordinate:{order:1},accepts:['knowledge'],cardinality:'one'},{id:'essence',label:'Essence',role:'essence',semanticCoordinate:{order:2},accepts:['knowledge'],cardinality:'one'}]},precedes={...base,id:'custom:precedes',name:'Existence precedes Essence',edges:[{id:'e',sourceSlotId:'existence',targetSlotId:'essence',direction:'directed',relationType:'precedes'}]},equals={...base,id:'custom:equals',name:'Existence equals Essence',edges:[{id:'e',sourceSlotId:'existence',targetSlotId:'essence',direction:'bidirectional',relationType:'equals'}]},sartreInstance=createStructureInstance(precedes,sartre.id),godInstance=createStructureInstance(equals,god.id),state={knowledge:[sartre,god],relations:[],structureTemplates:[precedes,equals],structureInstances:[sartreInstance,godInstance]};
  const matches=patternSearch({sourceRole:'existence',relationType:'precedes',targetRole:'essence',direction:'directed'},state);assert.deepEqual(matches.map(match=>match.ownerKnowledgeId),[sartre.id]);
});

test('V2 LMN migration preserves Knowledge and LMN instance UUIDs without deleting legacy data',()=>{
  const knowledge=createKnowledge('Legacy'),target=createKnowledge('Target'),createdAt=new Date().toISOString(),legacy={schema_version:2,knowledge:[knowledge,target],relations:[],representations:[],structures:[],lmns:[{id:'legacy-lmn-id',knowledgeId:knowledge.id,createdAt,updatedAt:createdAt,positions:{L1:{position:'L1',knowledgeId:target.id}}}]};
  const migrated=migrateV2ToV3(legacy);assert.equal(migrated.structureInstances[0].id,'legacy-lmn-id');assert.equal(migrated.structureInstances[0].bindings[0].targetId,target.id);assert.equal(migrated.legacy.lmns[0].id,'legacy-lmn-id');assert.equal(validateV3Bundle(migrated).valid,true);
});

test('V3 bundle round trip preserves template, instance and binding identities',()=>{
  const knowledge=createKnowledge('Round trip'),template=getBuiltinTemplate('builtin:regular-polygon'),instance=createStructureInstance(template,knowledge.id,{n:5}),state={knowledge:[knowledge],relations:[],representations:[],structureTemplates:BUILTIN_TEMPLATES,structureInstances:[instance]},bundle=exportV3Bundle(state),result=importV3Bundle(bundle,{knowledge:[],relations:[],representations:[],structureTemplates:[],structureInstances:[]});
  assert.equal(result.valid,true);assert.equal(result.state.knowledge[0].id,knowledge.id);assert.equal(result.state.structureInstances[0].id,instance.id);assert.equal(result.state.structureTemplates.some(item=>item.id===template.id),true);
});
