import test from 'node:test';
import assert from 'node:assert/strict';
import {exportLkl3,parseLkl3,buildLkl3ImportPlan} from '../packages/lkl3/package.js';
import {getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance} from '../packages/structure-engine/model.js';
import {buildSceneGeometry,routeEdge,fitScene} from '../packages/geometry/scene-geometry.js';
import {nestedProfiles} from '../packages/domain/object-profile.js';
import {migrateV3ToV4} from '../packages/structure-engine/migration.js';
import {solve} from '../packages/math/linear-algebra.js';
import {samplePlotExpression} from '../packages/structure-engine/plotting.js';

test('archive profile metadata cannot silently disappear',()=>{
 const doc=parseLkl3(exportLkl3({knowledge:[{id:'k',title:'知识'}]}));
 doc.records[0].profile.sources=['important-source'];
 assert.throws(()=>parseLkl3('lkl 3\n'+JSON.stringify(doc)),/data 不一致/);
 doc.records[0].data.sources=['important-source'];
 assert.equal(buildLkl3ImportPlan(doc,{}).nextState.knowledge[0].sources[0],'important-source');
 doc.records[0].data.title='new title';assert.equal(parseLkl3('lkl 3\n'+JSON.stringify(doc)).records[0].profile.title,'new title');
 assert.equal(nestedProfiles({'a/b~c':{id:'nested'}})[0].path,'/a~1b~0c');
});
test('copy isolates external identity and preserves the installed builtin style',()=>{
 const template=getBuiltinTemplate('builtin:n-center'),local={...structuredClone(template),visual:{accent:'#ff0000'}};
 const k={id:'k',title:'A',packageId:'package-a',externalStableId:'package-a/knowledge:k'},i=createStructureInstance(template,'k');
 const state={knowledge:[k],structureTemplates:[local],structureInstances:[]};
 const source=exportLkl3({knowledge:[k],structureTemplates:[template],structureInstances:[i]});
 const plan=buildLkl3ImportPlan(source,state,{strategy:'copy',copyId:'copy'});
 assert.equal(plan.committable,true,plan.errors.join('\n'));
 assert.equal(plan.nextState.knowledge.find(x=>x.id==='copy:k').externalStableId,'copy:package-a/knowledge:k');
 assert.equal(plan.nextState.knowledge.find(x=>x.id==='copy:k').packageId,'copy:package-a');
 assert.deepEqual(plan.nextState.structureTemplates.find(t=>t.id===template.id).visual,local.visual);
});
test('references, unknown factories and hidden ownership cycles fail before mutation',()=>{
 const t=getBuiltinTemplate('builtin:n-center'),i=createStructureInstance(t,'k'),state={knowledge:[{id:'k',title:'K'}],structureTemplates:[t],structureInstances:[i]};
 let plan=buildLkl3ImportPlan(exportLkl3({...state,representations:[{id:'r',knowledgeId:'k',kind:'structure',data:{instanceId:'missing'}}]}),{});
 assert.equal(plan.committable,false);assert.match(plan.errors.join(' '),/表征结构不存在/);
 i.bindings.push({id:'b',slotId:'n-center-2',instanceId:i.id,targetType:'knowledge',targetId:'k',metadata:{placementMode:'construct'}});
 plan=buildLkl3ImportPlan(exportLkl3(state),{});assert.equal(plan.committable,false);assert.match(plan.errors.join(' '),/循环/);
 assert.equal(buildLkl3ImportPlan(exportLkl3({structureTemplates:[{...t,id:'custom:x',builtin:false,slotFactory:'unknown:factory'}]}),{}).committable,false);
});
test('legacy builtin identification agrees with catalog migration even without builtin flag',()=>{
 const t={...structuredClone(getBuiltinTemplate('builtin:n-center')),version:3,slotFactory:null,parameters:[],slots:[],edges:[]};delete t.builtin;
 const i=createStructureInstance(t,'k'),state=migrateV3ToV4({schemaVersion:4,knowledge:[{id:'k',title:'old'}],relations:[],structureTemplates:[t],structureInstances:[i]});
 assert.match(state.structureInstances[0].templateId,/^legacy:/);
});
test('mathematical factories can be reused by custom templates, and tiny flows remain visible',()=>{
 const t={...getBuiltinTemplate('builtin:permutation'),id:'custom:permutation-copy',builtin:false};
 assert.deepEqual(materializeTemplate(t).runtimeMetadata.cycles,[[1,2,3],[4]]);
 assert.equal(materializeTemplate(getBuiltinTemplate('builtin:flow-network'),{arcs:'s,t,1e-15'}).runtimeMetadata.maxFlow,1e-15);
});
test('linear-system consistency is relative to RHS scale',()=>{
 assert.throws(()=>solve([[1],[1]],[[1e-20],[2e-20]]),/无解/);
 assert.deepEqual(solve([[1],[1]],[[1e-20],[1e-20]]),[[1e-20]]);
});
test('surface real-domain gaps preserve valid parts; sampled poles are not connected',()=>{
 assert.ok(samplePlotExpression('z=sqrt(x)').segments.length>0);
 const plot=samplePlotExpression('y=1/x',{samples:239,range:[-1,1]});
 assert.ok(plot.segments.length>=2);assert.ok(plot.segments.every(line=>!(line[0].x<0&&line.at(-1).x>0)));
});
test('fitting includes plotted geometry and fixed-point relations have proper loops',()=>{
 const t=getBuiltinTemplate('builtin:coordinate-plane'),i=createStructureInstance(t,'k',{dimension:'3d'});
 i.plotExpressions=[{id:'surface',source:'z=x^2+y^2',rangeMode:'manual',ranges:{u:[-2,2],v:[-2,2]}}];
 const scene=buildSceneGeometry(materializeTemplate(t,i.parameters),i),box=scene.background.find(x=>x.plotBounds)?.plotBounds;
 assert.ok(box);assert.ok(scene.bounds.y<=box.yMin);const fit=fitScene(scene,{width:400,height:300});assert.ok(fit.zoom*scene.bounds.height<=300);
 const node={id:'fixed',x:100,y:100,width:120,height:60},loop=routeEdge(node,node);assert.equal(loop.selfLoop,true);assert.match(loop.path,/ C /);assert.notDeepEqual(loop.start,loop.end);
});

