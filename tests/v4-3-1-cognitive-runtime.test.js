import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledge,createRelation,dependencyClosure,directedTraversal,shortestMeaningfulPath} from '../packages/domain/core.js';
import {ensureObjectContent} from '../packages/domain/semantic-container.js';
import {BUILTIN_TEMPLATES,getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,validateInstance} from '../packages/structure-engine/model.js';
import {TaskContextStore,createTaskContext,updateTaskContext} from '../packages/cognitive-runtime/task-context.js';
import {buildSemanticIndex} from '../packages/cognitive-runtime/semantic-index.js';
import {activateKnowledge} from '../packages/cognitive-runtime/activation.js';
import {createDerivedProjection,persistDerivedProjection} from '../packages/cognitive-runtime/derived-projection.js';
import {composeDomainProfiles} from '../packages/cognitive-runtime/domain-profiles.js';
import {composeTaskSchema} from '../packages/cognitive-runtime/task-schemas.js';
import {textSearch} from '../packages/search-engine/search.js';

const fixture=()=>{
  const definition=createKnowledge('Definition','A group has an associative operation.');definition.aliases=['group definition'];ensureObjectContent(definition).tags=['algebra'];ensureObjectContent(definition).sources=[{title:'Algebra notes'}];
  const theorem=createKnowledge('Lagrange theorem','The order of a subgroup divides the group order.');ensureObjectContent(theorem).contentType='theorem';
  const proof=createKnowledge('Proof by cosets','Partition the group into left cosets.');ensureObjectContent(proof).contentType='proof';
  const remote=createKnowledge('Unrelated poetry','A distant subject.');
  const r1=createRelation(theorem.id,definition.id,'depends-on','uses definition'),r2=createRelation(proof.id,theorem.id,'proves','proves theorem');
  const template=structuredClone(getBuiltinTemplate('builtin:proof-tree')),instance=createStructureInstance(template,theorem.id);instance.containers[Object.keys(instance.containers)[0]].content.body='premise inference conclusion';
  return{knowledge:[definition,theorem,proof,remote],relations:[r1,r2],representations:[],structureTemplates:structuredClone(BUILTIN_TEMPLATES),structureInstances:[instance],contentObjects:[]};
};

test('Task Context lifecycle remains separate from Knowledge ontology',()=>{
  const state=fixture(),before=structuredClone(state.knowledge),context=createTaskContext({goal:'Understand Lagrange theorem',focus:['proof']});
  const updated=updateTaskContext(context,{activeKnowledgeIds:[state.knowledge[1].id]});assert.equal(updated.goal,context.goal);assert.deepEqual(state.knowledge,before);
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},store=new TaskContextStore(storage);store.save(updated);assert.deepEqual(store.load().activeKnowledgeIds,updated.activeKnowledgeIds);store.clear();assert.equal(data.size,0);
});

test('Unified Semantic Index covers content, aliases, tags, sources, relations and structure roles',()=>{
  const state=fixture(),index=buildSemanticIndex(state);
  assert.equal(index.search('group definition')[0].kind,'knowledge');
  assert.ok(index.search('algebra').some(hit=>hit.kind==='knowledge'));
  assert.ok(index.search('Algebra notes').some(hit=>hit.kind==='knowledge'));
  assert.ok(index.search('uses definition').some(hit=>hit.kind==='relation'));
  assert.ok(index.search('premise').some(hit=>hit.kind==='slot'));
  assert.ok(textSearch('cosets',state).some(hit=>hit.type==='knowledge'));
});

test('Activation is deterministic, bounded and expands meaningful relations',()=>{
  const state=fixture(),taskContext=createTaskContext({goal:'Learn Lagrange theorem',taskType:'proof-learning'}),activation=activateKnowledge({taskContext,cue:'cosets',state,maxCandidates:3,maxRelationDepth:2});
  assert.ok(activation.activeKnowledgeIds.length>0);assert.ok(activation.activeKnowledgeIds.length<=3);assert.ok(activation.activeKnowledgeIds.includes(state.knowledge[1].id));assert.ok(activation.activeRelationIds.length>0);assert.equal(activation.activeKnowledgeIds.includes(state.knowledge[3].id),false);
});

test('Derived Projection is ephemeral until explicit persistence and reloads as a valid instance',()=>{
  const state=fixture(),taskContext=createTaskContext({goal:'Trace proof dependencies',taskType:'proof-learning'}),activation=activateKnowledge({taskContext,cue:'theorem proof',state,maxCandidates:3}),count=state.structureInstances.length;
  const projection=createDerivedProjection({taskContext,activation,state,projectionType:'proof'});assert.equal(projection.ephemeral,true);assert.equal(state.structureInstances.length,count);assert.equal(projection.instance.templateId,'builtin:proof-tree');
  const saved=persistDerivedProjection(projection,{ownerKnowledgeId:state.knowledge[1].id}),reloaded=JSON.parse(JSON.stringify(saved));assert.equal(validateInstance(reloaded,state.structureTemplates,[...state.structureInstances,reloaded],state.knowledge).valid,true);assert.equal(reloaded.runtimeMetadata.cognitiveProjection.persistence,'persistent');
});

test('Relation helpers and lightweight task/domain composition remain reusable',()=>{
  const state=fixture(),source=state.knowledge[2].id,target=state.knowledge[0].id;assert.ok(directedTraversal(state.relations,source,{depth:2}).nodeIds.includes(target));assert.deepEqual(shortestMeaningfulPath(state.relations,source,target).nodeIds,[source,state.knowledge[1].id,target]);assert.ok(dependencyClosure(state.relations,state.knowledge[1].id,{direction:'outgoing'}).nodeIds.includes(target));assert.ok(composeTaskSchema('proof-learning','explanation').operations.includes('communicate'));assert.ok(composeDomainProfiles('general','mathematics').preferredStructures.includes('builtin:proof-tree'));
});
