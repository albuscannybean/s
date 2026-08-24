import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledge,createRelation,neighborhood,detectCycle,transitiveReduction} from '../packages/domain/core.js';

test('Knowledge identity is UUID-based and independent from Structure',()=>{
  const a=createKnowledge('A'),b=createKnowledge('A');
  assert.notEqual(a.id,b.id);assert.equal(a.title,b.title);assert.equal('lmn'in a,false);assert.equal('structureId'in a,false);
});

test('critical reuse scenario keeps exactly three entities and two relations',()=>{
  const A=createKnowledge('A'),B=createKnowledge('B'),C=createKnowledge('C'),r1=createRelation(A.id,B.id),r2=createRelation(C.id,A.id),knowledge=[A,B,C],relations=[r1,r2];
  const graph=neighborhood(knowledge,relations,C.id,2);assert.equal(knowledge.length,3);assert.equal(relations.length,2);assert.deepEqual(new Set(graph.nodes.map(item=>item.id)),new Set([A.id,B.id,C.id]));
});

test('cycle detection terminates',()=>assert.equal(detectCycle(['a','b'],[{sourceId:'a',targetId:'b'},{sourceId:'b',targetId:'a'}]),true));

test('Hasse transitive reduction removes a redundant semantic edge',()=>{
  const result=transitiveReduction(['a','b','c'],[{id:'1',sourceId:'a',targetId:'b'},{id:'2',sourceId:'b',targetId:'c'},{id:'3',sourceId:'a',targetId:'c'}]);
  assert.deepEqual(result.edges.map(item=>item.id),['1','2']);
});
