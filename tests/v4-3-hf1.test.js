import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDeletionPlan,commitDeletionPlan,executeDeletionPlan,validateDeletionResult} from '../packages/domain/object-management.js';

const template={id:'template:test',name:'Test',slots:[],edges:[]};
const knowledge=(id,extra={})=>({id,title:id,...extra});
const structure=(id,ownerKnowledgeId,bindings=[],extra={})=>({id,templateId:template.id,ownerKnowledgeId,bindings,containers:{},...extra});
const binding=(id,targetType,targetId,mode='construct')=>({id,slotId:'slot',targetType,targetId,metadata:{placementMode:mode}});
const base=extra=>({knowledge:[],relations:[],representations:[],structureTemplates:[structuredClone(template)],structureInstances:[],variableSchemes:[],knowledgePackages:[],contentObjects:[],structureViews:[],boards:[],placements:[],settings:[],...extra});

test('HF1 deletes a complete multi-level construct subtree',()=>{
  const state=base({knowledge:[knowledge('A'),knowledge('B'),knowledge('C')],structureInstances:[structure('S1','A',[binding('S1-B','knowledge','B')]),structure('S2','B',[binding('S2-C','knowledge','C')])],structureViews:[{id:'V1',instanceId:'S1'},{id:'V2',instanceId:'S2'}],placements:[{id:'P1',parentType:'structure',parentId:'S1',targetType:'knowledge',targetId:'B',mode:'construct'}]});
  const plan=buildDeletionPlan(state,{type:'knowledge',id:'A'}),next=executeDeletionPlan(state,plan);
  assert.deepEqual(plan.counts,{knowledge:3,structures:2,content:0,boards:0,templates:0});
  assert.equal(next.knowledge.length,0);assert.equal(next.structureInstances.length,0);assert.equal(next.structureViews.length,0);assert.equal(next.placements.length,0);assert.equal(validateDeletionResult(next).valid,true);
});

test('HF1 removes external references and relations without propagating deletion',()=>{
  const state=base({knowledge:[knowledge('A'),knowledge('B'),knowledge('X')],structureInstances:[structure('S','A',[binding('S-B','knowledge','B')]),structure('SX','X',[binding('ref-B','knowledge','B','reference')])],relations:[{id:'R',sourceId:'X',targetId:'B'}],placements:[{id:'PR',parentType:'structure',parentId:'SX',targetType:'knowledge',targetId:'B',mode:'reference'}]});
  const plan=buildDeletionPlan(state,{type:'knowledge',id:'A'}),next=executeDeletionPlan(state,plan);
  assert.equal(plan.externalReferences.length,1);assert.equal(plan.externalRelations.length,1);
  assert.deepEqual(next.knowledge.map(item=>item.id),['X']);assert.deepEqual(next.structureInstances.map(item=>item.id),['SX']);assert.equal(next.structureInstances[0].bindings.length,0);assert.equal(next.relations.length,0);assert.equal(next.placements.length,0);
});

test('HF1 deleting a Structure deletes its construct descendants but preserves its owner Knowledge',()=>{
  const state=base({knowledge:[knowledge('A'),knowledge('B'),knowledge('C')],structureInstances:[structure('S1','A',[binding('S1-B','knowledge','B')]),structure('S2','B',[binding('S2-C','knowledge','C')])]});
  const next=executeDeletionPlan(state,buildDeletionPlan(state,{type:'structure',id:'S1'}));
  assert.deepEqual(next.knowledge.map(item=>item.id),['A']);assert.equal(next.structureInstances.length,0);
});

test('HF1 package-root deletion removes its namespace and cleans cross-package references',()=>{
  const packageId='pkg:one',root=knowledge('A',{packageId,stableId:'root'}),child=knowledge('B',{packageId,stableId:'child'}),outside=knowledge('X',{packageId:'pkg:two'}),packTemplate={...structuredClone(template),id:'template:package',packageId},inside=structure('S','A',[binding('S-B','knowledge','B')],{packageId,templateId:packTemplate.id}),external=structure('SX','X',[binding('ref-B','knowledge','B','reference')],{packageId:'pkg:two'});
  const state=base({knowledge:[root,child,outside],structureTemplates:[structuredClone(template),packTemplate],structureInstances:[inside,external],knowledgePackages:[{id:'PK',packageId,stableId:packageId,rootKnowledgeId:'A'},{id:'PK2',packageId:'pkg:two',stableId:'pkg:two',rootKnowledgeId:'X'}],contentObjects:[{id:'C',packageId}],structureViews:[{id:'V',instanceId:'S',packageId}],relations:[{id:'R',sourceId:'X',targetId:'B'}]});
  const plan=buildDeletionPlan(state,{type:'knowledge',id:'A'}),next=executeDeletionPlan(state,plan);
  assert.equal(plan.mode,'package');assert.equal(plan.counts.templates,1);assert.deepEqual(next.knowledge.map(item=>item.id),['X']);assert.equal(next.structureTemplates.some(item=>item.id===packTemplate.id),false);assert.equal(next.knowledgePackages.some(item=>item.id==='PK'),false);assert.equal(next.structureInstances[0].bindings.length,0);assert.equal(next.relations.length,0);assert.equal(validateDeletionResult(next).valid,true);
});

test('HF1 batch deletion merges overlapping closures and removes every selected tree once',()=>{
  const state=base({knowledge:[knowledge('A'),knowledge('B'),knowledge('D'),knowledge('E'),knowledge('X')],structureInstances:[structure('SA','A',[binding('A-B','knowledge','B')]),structure('SD','D',[binding('D-E','knowledge','E')])]});
  const plan=buildDeletionPlan(state,[{type:'knowledge',id:'A'},{type:'knowledge',id:'B'},{type:'knowledge',id:'D'}],{mode:'batch'}),next=executeDeletionPlan(state,plan);
  assert.equal(plan.mode,'batch');assert.equal(plan.counts.knowledge,4);assert.deepEqual(next.knowledge.map(item=>item.id),['X']);
});

test('HF1 transactional commit leaves the original state untouched when persistence fails',async()=>{
  const state=base({knowledge:[knowledge('A')]}),before=structuredClone(state),plan=buildDeletionPlan(state,{type:'knowledge',id:'A'});
  await assert.rejects(()=>commitDeletionPlan(state,plan,{persist:async()=>{throw new Error('disk failure')}}),/disk failure/);assert.deepEqual(state,before);
});

test('HF1 deletes a 1000-object construct tree in one plan without orphans',()=>{
  const knowledgeItems=[],structures=[];for(let index=0;index<500;index++){knowledgeItems.push(knowledge(`K${index}`));structures.push(structure(`S${index}`,`K${index}`,index<499?[binding(`B${index}`,'knowledge',`K${index+1}`)]:[]))}
  const state=base({knowledge:knowledgeItems,structureInstances:structures}),plan=buildDeletionPlan(state,{type:'knowledge',id:'K0'}),next=executeDeletionPlan(state,plan);
  assert.equal(plan.total,1000);assert.equal(next.knowledge.length,0);assert.equal(next.structureInstances.length,0);assert.equal(validateDeletionResult(next).valid,true);
});
