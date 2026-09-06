import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatrix,multiply,inverse,determinant,rank,rref,solve,parseVector,vectorOperation} from '../packages/math/linear-algebra.js';
import {evaluateMathExpression,parsePlotExpression,samplePlotExpression} from '../packages/structure-engine/plotting.js';
import {BUILTIN_TEMPLATES,getBuiltinTemplate,materializeTemplate,getStructureCapabilities} from '../packages/structure-engine/templates.js';
import {createStructureInstance,validateTemplate} from '../packages/structure-engine/model.js';
import {exportLkl3,parseLkl3,buildLkl3ImportPlan} from '../packages/lkl3/package.js';
import {migrateV3ToV4} from '../packages/structure-engine/migration.js';
import {tokenizeInline} from '../packages/ui/math-markup.js';
import {safeMediaUrl} from '../packages/ui/portable-media.js';
const model=(id,p={})=>materializeTemplate(getBuiltinTemplate('builtin:'+id),p);

test('matrix operations handle shape, rank, inverse and consistent rectangular systems',()=>{
 const A=parseMatrix('1 2\n3 4');assert.equal(determinant(A),-2);assert.equal(rank([[1,2],[2,4]]),1);
 const I=multiply(A,inverse(A));I.forEach((row,i)=>row.forEach((x,j)=>assert.ok(Math.abs(x-+(i===j))<1e-12)));
 assert.deepEqual(rref([[1,2],[2,4]]),[[1,2],[0,0]]);
 assert.deepEqual(solve([[1,0],[0,1],[1,1]],[[2],[3],[5]]),[[2],[3]]);
 assert.throws(()=>solve([[1],[1]],[[1],[2]]),/无解/);
 assert.throws(()=>inverse([[1,2],[2,4]]),/奇异/);assert.throws(()=>multiply([[1,2]],[[1,2]]),/列数/);
 assert.equal(inverse([[1e-20]])[0][0],1e20);
});
test('vector operations respect dimensional and zero-vector boundaries',()=>{
 assert.deepEqual(parseVector('1, 2, 3'),[1,2,3]);assert.deepEqual(vectorOperation('cross',[1,0,0],[0,1,0]),[0,0,1]);
 assert.equal(vectorOperation('dot',[1,2],[3,4]),11);assert.throws(()=>vectorOperation('angle',[0,0],[1,1]),/零向量/);
});
test('curve and surface grammar preserves mathematical precedence and rejects executable expressions',()=>{
 assert.equal(evaluateMathExpression('-2^2'),-4);assert.equal(evaluateMathExpression('2^-2'),.25);
 assert.equal(parsePlotExpression('sin(x)').kind,'function');
 assert.equal(parsePlotExpression('f(x,y)=x^2+y^2').kind,'surface');
 assert.ok(samplePlotExpression('z=sin(x)*cos(y)').segments.length>0);
 assert.equal(parsePlotExpression('x=cos(t); y=sin(t)').kind,'parametric');
 assert.equal(parsePlotExpression('x=u; y=v; z=u*v').kind,'surface');
 assert.throws(()=>evaluateMathExpression('globalThis.alert(1)'));
});
test('new structures implement their mathematical models and reject invalid data',()=>{
 const mapping=model('function-mapping');assert.equal(mapping.runtimeMetadata.injective,false);assert.equal(mapping.runtimeMetadata.surjective,true);
 assert.throws(()=>model('function-mapping',{images:'1,1'}),/恰有一个/);
 assert.equal(model('commutative-diagram').runtimeMetadata.commutes,true);
 assert.equal(model('commutative-diagram',{f:'1,1,2'}).runtimeMetadata.commutes,false);
 assert.throws(()=>model('set-partition',{groups:'a,b|b,c'}),/重复/);
 assert.equal(model('equivalence-classes').edges.length,0);assert.equal(model('cartesian-product').runtimeMetadata.cardinality,6);
 assert.deepEqual(model('permutation').runtimeMetadata.cycles,[[1,2,3],[4]]);assert.throws(()=>model('permutation',{images:'1,1'}));
 assert.equal(model('transformation-group',{n:4}).runtimeMetadata.order,8);
 assert.equal(model('flow-network').runtimeMetadata.maxFlow,4);
 assert.ok(Math.abs(model('dynamical-system',{r:2,x0:.25,steps:2}).runtimeMetadata.trajectory[1]-.375)<1e-12);
 for(const t of BUILTIN_TEMPLATES)assert.equal(validateTemplate(materializeTemplate(t)).valid,true,t.id);
});
test('n-center is discoverable, unordered and displays an owner without a reverse ownership binding',()=>{
 const t=getBuiltinTemplate('builtin:n-center'),instance=createStructureInstance(t,'knowledge:root',{members:'甲,乙,丙'});
 assert.equal(model('n-center',{members:'甲,乙,丙'}).slots.length,4);assert.equal(instance.bindings.length,0);
 assert.equal(getStructureCapabilities().find(c=>c.id===t.id).ordering,'unordered');
});
test('legacy skeleton instances preserve old template identity and content on migration',()=>{
 const t={...structuredClone(getBuiltinTemplate('builtin:permutation')),version:2,slotFactory:undefined,slots:[{id:'permutation-1',label:'old',role:'one',semanticCoordinate:{},accepts:['knowledge'],cardinality:'many'}],edges:[],parameters:[],layout:{type:'grid'}};
 const instance=createStructureInstance(t,'k');instance.containers['permutation-1'].content.body='保留的资料';
 const next=migrateV3ToV4({schemaVersion:4,knowledge:[{id:'k',title:'旧知识'}],relations:[],representations:[],structureTemplates:[t],structureInstances:[instance]});
 assert.equal(next.structureInstances[0].id,instance.id);assert.match(next.structureInstances[0].templateId,/^legacy:/);assert.equal(next.structureInstances[0].containers['permutation-1'].content.body,'保留的资料');
});
test('LKL 3 preserves full records, images, profile information and arbitrary supported nested fields',()=>{
 const t=getBuiltinTemplate('builtin:n-center'),instance=createStructureInstance(t,'k');instance.customData={revision:'user field'};instance.profile={authors:['Ada'],extensions:{evidence:'source 1'}};
 const state={knowledge:[{id:'k',title:'知识',content:'![像](data:image/png;base64,iVBORw0KGgo=)',profile:{authors:['Ada']}}],relations:[],structureTemplates:[t],structureInstances:[instance]};
 const source=exportLkl3(state),document=parseLkl3(source);assert.equal(document.records.find(r=>r.id===instance.id).profile.authors[0],'Ada');
 const plan=buildLkl3ImportPlan(source,{});assert.equal(plan.committable,true,plan.errors.join('\n'));
 assert.deepEqual(plan.nextState.structureInstances[0].customData,instance.customData);assert.equal(plan.nextState.knowledge[0].content,state.knowledge[0].content);
 const second=parseLkl3(exportLkl3(plan.nextState));for(const r of document.records)assert.deepEqual(second.records.find(x=>x.id===r.id).data,r.data);
 const copy=buildLkl3ImportPlan(source,state,{strategy:'copy',copyId:'copy'});assert.equal(copy.committable,true,copy.errors.join('\n'));assert.equal(copy.nextState.structureInstances.find(i=>i.id==='copy:'+instance.id).ownerKnowledgeId,'copy:k');
});
test('invalid LKL 3 references and duplicate records fail without mutating current state',()=>{
 const current={knowledge:[{id:'k',title:'existing'}]},source=exportLkl3(current),doc=parseLkl3(source);doc.package.roots=['missing'];
 const plan=buildLkl3ImportPlan(doc,current);assert.equal(plan.committable,false);assert.deepEqual(plan.nextState,current);
 doc.records.push(doc.records[0]);assert.throws(()=>parseLkl3('lkl 3\n'+JSON.stringify(doc)),/重复档案/);
});
test('portable image parsing accepts data images and blocks executable links',()=>{
 assert.equal(tokenizeInline('![demo](data:image/png;base64,iVBORw0KGgo=)')[0].type,'image');
 assert.equal(safeMediaUrl('javascript:alert(1)'),null);assert.equal(safeMediaUrl('data:image/svg+xml;base64,AAAA',{image:true}),null);
});
