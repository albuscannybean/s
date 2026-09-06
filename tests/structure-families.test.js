import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_TEMPLATES,getBuiltinTemplate,getStructureCapabilities,materializeTemplate} from '../packages/structure-engine/templates.js';
import {addInstanceEdge,addInstanceSlot,appendStructureNode,createStructureInstance,materializeInstanceDefinition,updateInstanceSlot} from '../packages/structure-engine/model.js';
import {formatSequenceName,nextSequentialLabel} from '../packages/domain/naming-policy.js';
import {migrateV3ToV4} from '../packages/structure-engine/migration.js';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';

test('equivalent directed and Venn choices expose one family, with resolvable historical aliases',()=>{
 const ids=new Set(getStructureCapabilities().map(c=>c.id));
 for(const alias of ['timeline','dependency-dag','proof-tree','venn-2','venn-3']){const t=getBuiltinTemplate('builtin:'+alias);assert.equal(t.hidden,true);assert.equal(ids.has(t.id),false);assert.ok(ids.has(t.replacementTemplateId));}
 assert.ok(ids.has('builtin:mod-n'));assert.ok(ids.has('builtin:cyclic-group'));assert.ok(ids.has('builtin:flow-network'));
 const directed=getStructureCapabilities().find(t=>t.id==='builtin:directed-graph');assert.ok(directed.family.presets.some(p=>p.id==='dependency'));assert.equal(directed.compatibilityAliases.length,3);
});

test('directed families parameterize count independently of topology, direction and labels',()=>{
 const t=getBuiltinTemplate('builtin:directed-graph'),instance=createStructureInstance(t,'k',{nodeCount:7,topology:'dag',layoutMode:'layered',numbering:'custom',numberFormat:'P{n}',numberStart:3});
 const d=materializeInstanceDefinition(t,instance);assert.equal(d.slots.length,7);assert.equal(d.slots[0].label,'P3');assert.equal(d.slots.at(-1).label,'P9');
 assert.equal(d.edges.length,6);assert.equal(d.layout.type,'layered');assert.throws(()=>addInstanceEdge(instance,'G','A'),/循环/);
 const parallel=addInstanceEdge(instance,'A','B',{label:'另一证据'});assert.notEqual(parallel.id,d.edges[0].id);assert.equal(materializeInstanceDefinition(t,instance).edges.filter(e=>e.sourceSlotId==='A'&&e.targetSlotId==='B').length,2);
 assert.throws(()=>materializeTemplate(t,{nodeCount:0}),/节点数量/);
 const network=createStructureInstance(t,null,{topology:'network'}),initial=materializeInstanceDefinition(t,network);appendStructureNode(network,t);assert.equal(materializeInstanceDefinition(t,network).edges.length,initial.edges.length,'Growing a free graph must not assert a new semantic relation');
});

test('n-center grows with an optional numbering grammar without moving content identities',()=>{
 const t=getBuiltinTemplate('builtin:n-center'),instance=createStructureInstance(t,'owner',{nodeCount:7,numbering:'custom',numberFormat:'面向-{n}',numberStart:1});
 const before=materializeInstanceDefinition(t,instance);instance.containers[before.slots[1].id].content.body='保留正文';
 const appended=appendStructureNode(instance,t);assert.equal(appended.label,'面向-8');assert.equal(instance.parameters.nodeCount,8);
 const after=materializeInstanceDefinition(t,instance);assert.equal(after.slots.length,9);assert.equal(after.edges.length,8);assert.equal(instance.containers[before.slots[1].id].content.body,'保留正文');
 assert.deepEqual(after.slots.slice(0,8).map(s=>s.id),before.slots.map(s=>s.id));assert.equal(new Set(after.edges.map(e=>e.id)).size,8);
 const noNumber=materializeTemplate(t,{nodeCount:2,numbering:'none',members:'工作,休息'});assert.deepEqual(noNumber.slots.slice(1).map(s=>s.label),['工作','休息']);
 assert.equal(materializeTemplate(t,{members:'甲,乙,丙'}).slots.length,4);assert.throws(()=>materializeTemplate(t,{nodeCount:2,members:'甲,乙,丙'}),/标签数量/);
 const scene=buildSceneGeometry(after,instance);assert.equal(scene.nodes.length,9);
});

test('new nodes and independent relations continue naming including zero padding and subscripts',()=>{
 assert.equal(nextSequentialLabel(['步骤 01','步骤 02']),'步骤 03');assert.equal(nextSequentialLabel(['v₁','v₂']),'v₃');assert.equal(nextSequentialLabel(['A','Z']),'AA');
 assert.equal(formatSequenceName(3,{style:'custom',format:'({i}) {label}',label:'证明'}),'(IV) 证明');
 assert.throws(()=>formatSequenceName(0,{style:'roman',start:Infinity}),/有限数值/);assert.throws(()=>formatSequenceName(0,{style:'custom',format:'{executable}'}),/只支持/);
 const custom={...structuredClone(getBuiltinTemplate('builtin:empty-custom')),id:'custom',slots:[{id:'one',label:'P01',role:'node',semanticCoordinate:{},accepts:['knowledge'],cardinality:'many'},{id:'two',label:'P02',role:'node',semanticCoordinate:{},accepts:['knowledge'],cardinality:'many'}],edges:[{id:'e1',sourceSlotId:'one',targetSlotId:'two',label:'关系 01',direction:'directed',relationType:'supports'}]},instance=createStructureInstance(custom);
 assert.equal(addInstanceSlot(instance).label,'P03');assert.equal(addInstanceSlot(instance).label,'P04');
 assert.equal(addInstanceEdge(instance,'one','two').label,'关系 02');assert.equal(addInstanceEdge(instance,'one','two').label,'关系 03');
 updateInstanceSlot(instance,'two',{label:'P10'});assert.equal(addInstanceSlot(instance).label,'P11');
 const d=materializeInstanceDefinition(custom,instance);assert.equal(new Set(d.edges.map(e=>e.id)).size,3);
});

test('directed chain append extends its existing edge names and keeps saved topology untouched',()=>{
 const t=getBuiltinTemplate('builtin:directed-graph'),instance=createStructureInstance(t,null,{nodeCount:3,topology:'chain',relationLabel:'步骤 01'});instance.overrides.edgePatches.bc={label:'步骤 02'};
 assert.equal(appendStructureNode(instance,t).label,'D');assert.equal(materializeInstanceDefinition(t,instance).edges.at(-1).label,'步骤 03');
 const old={...structuredClone(t),version:2,slotFactory:undefined,parameters:[],slots:[{id:'A',label:'旧 A',role:'node',semanticCoordinate:{},accepts:['knowledge'],cardinality:'many'},{id:'B',label:'旧 B',role:'node',semanticCoordinate:{},accepts:['knowledge'],cardinality:'many'}],edges:[{id:'old-loop',sourceSlotId:'A',targetSlotId:'A',direction:'directed',relationType:'feedback'}],layout:{type:'force'}};
 const previous=createStructureInstance(old,'k');previous.containers.A.content.body='旧内容';
 const migrated=migrateV3ToV4({schemaVersion:4,knowledge:[{id:'k',title:'K'}],relations:[],representations:[],structureTemplates:[old],structureInstances:[previous]});
 assert.match(migrated.structureInstances[0].templateId,/^legacy:/);assert.equal(migrated.structureInstances[0].containers.A.content.body,'旧内容');
 const oldModel=materializeInstanceDefinition(migrated.structureTemplates.find(t=>t.id===migrated.structureInstances[0].templateId),migrated.structureInstances[0]);assert.equal(oldModel.edges[0].id,'old-loop');assert.equal(oldModel.layout.type,'force');
});

test('Venn set count materializes exactly all supported membership regions',()=>{
 const t=getBuiltinTemplate('builtin:venn');for(const count of[2,3]){const d=materializeTemplate(t,{setCount:String(count)});assert.equal(d.slots.length,2**count-1);assert.equal(d.layout.sets,count);assert.equal(d.edges.length,0);assert.ok(d.slots.every(s=>s.semanticCoordinate.sets.length+s.semanticCoordinate.excludes.length===count));}
 assert.throws(()=>materializeTemplate(t,{setCount:'4'}),/两个或三个/);
});
