import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledge,createRelation} from '../packages/domain/core.js';
import {ensureObjectContent} from '../packages/domain/semantic-container.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {validateInstance} from '../packages/structure-engine/model.js';
import {createTaskContext} from '../packages/cognitive-runtime/task-context.js';
import {resolveDomainInput} from '../packages/cognitive-runtime/domain-profiles.js';
import {compileCognitiveTask,autoOrganizeKnowledge} from '../packages/cognitive-runtime/compiler.js';
import {persistDerivedProjection} from '../packages/cognitive-runtime/derived-projection.js';

const knowledge=(title,body,contentType='note',tags=[])=>{
  const item=createKnowledge(title,body),content=ensureObjectContent(item);
  content.body=body;content.contentType=contentType;content.tags=tags;
  return item;
};

const stateOf=(items,relations=[])=>({
  knowledge:items,
  relations,
  representations:[],
  structureTemplates:structuredClone(BUILTIN_TEMPLATES),
  structureInstances:[],
  contentObjects:[]
});

function mathematicsFixture(){
  const definition=knowledge('Group definition','Definition and premise: a group has an associative operation, identity and inverse.','definition',['mathematics','algebra']);
  const goal=knowledge('Lagrange theorem','Goal theorem and conclusion: the order of a subgroup divides the order of a finite group.','theorem',['mathematics','group theory']);
  const lemma=knowledge('Coset partition lemma','Supporting theorem and bridge: left cosets partition a finite group into equal-sized classes.','theorem',['mathematics','lemma']);
  const method=knowledge('Proof method by cosets','Proof method: construct a bijection between every left coset and the subgroup.','proof',['mathematics','proof strategy']);
  const proof=knowledge('Proof of Lagrange theorem','Proof: use the coset partition lemma and cardinality multiplication to derive the conclusion.','proof',['mathematics','proof']);
  const example=knowledge('Cyclic group example','Example applying Lagrange theorem to subgroups of a cyclic group.','example',['mathematics']);
  const counterexample=knowledge('Infinite group boundary','Counterexample and boundary: the finite-order statement needs a finiteness assumption.','counterexample',['mathematics','boundary']);
  const literature=knowledge('Hamlet character motif','Literary character, poetry, voice and tragic motif in a dramatic work.','reference',['literature','poetry']);
  const relations=[
    createRelation(proof.id,goal.id,'proves','coset argument proves the theorem'),
    createRelation(goal.id,lemma.id,'depends-on','the theorem depends on the partition lemma'),
    createRelation(lemma.id,definition.id,'requires','the lemma requires the group definition'),
    createRelation(method.id,proof.id,'supports','the method supports this proof'),
    createRelation(example.id,goal.id,'example-of','application of the theorem'),
    createRelation(counterexample.id,goal.id,'constrains','records the finite-group boundary')
  ];
  return{state:stateOf([definition,goal,lemma,method,proof,example,counterexample,literature],relations),definition,goal,lemma,method,proof,example,counterexample,literature};
}

function philosophyFixture(){
  const problem=knowledge('Problem of political freedom','Philosophical problem: what makes a person politically free?','note',['philosophy','problem']);
  const concept=knowledge('Freedom as self-direction','Concept and definition: freedom is self-direction under reasons one can endorse.','definition',['philosophy','concept']);
  const distinction=knowledge('Negative and positive freedom','Distinction and contrast between absence of interference and self-mastery.','note',['philosophy','distinction']);
  const premise=knowledge('Agency premise','Premise and commitment: responsible agency requires the capacity to act for reasons.','note',['philosophy','premise']);
  const consequence=knowledge('Institutional consequence','Consequence: institutions can enable as well as constrain agency.','note',['philosophy','consequence']);
  const objection=knowledge('Paternalism objection','Objection and boundary: self-mastery language may license paternalistic coercion.','counterexample',['philosophy','objection']);
  const application=knowledge('Education application','Example and application: education can expand practical agency without dictating a life plan.','example',['philosophy','application']);
  const relations=[
    createRelation(concept.id,problem.id,'responds-to','the concept responds to the problem'),
    createRelation(distinction.id,concept.id,'contrasts-with','negative freedom contrasts with self-direction'),
    createRelation(premise.id,concept.id,'supports','agency supports the concept'),
    createRelation(concept.id,consequence.id,'implies','the concept has an institutional consequence'),
    createRelation(objection.id,concept.id,'objects-to','the objection challenges the concept'),
    createRelation(application.id,concept.id,'example-of','an application of the concept')
  ];
  return{state:stateOf([problem,concept,distinction,premise,consequence,objection,application],relations),problem,concept,distinction,premise,consequence,objection,application};
}

const rolesFor=compilation=>new Map(compilation.roles.map(item=>[item.knowledgeId,item.primaryRole]));

test('mathematics proof-learning compiles real evidence into a valid ephemeral Proof Tree',()=>{
  const fixture=mathematicsFixture(),before=structuredClone(fixture.state.knowledge),taskContext=createTaskContext({goal:'Learn the proof of Lagrange theorem',taskType:'proof-learning',domainConstraints:['mathematics'],focus:['Lagrange theorem','coset proof']});
  const result=autoOrganizeKnowledge({taskContext,cue:'goal premise theorem proof bridge conclusion',state:fixture.state,maxCandidates:7,maxRelationDepth:2});
  const active=new Set(result.activation.activeKnowledgeIds),roles=rolesFor(result);

  assert.ok(active.has(fixture.goal.id));
  assert.ok(active.has(fixture.definition.id));
  assert.ok(active.has(fixture.proof.id));
  assert.equal(active.has(fixture.literature.id),false);
  assert.ok(['goal','conclusion','known-theorem'].includes(roles.get(fixture.goal.id)));
  assert.ok(['premise','definition'].includes(roles.get(fixture.definition.id)));
  assert.ok(['proof','proof-method'].includes(roles.get(fixture.proof.id)));
  assert.ok(result.topology.edges.some(edge=>edge.type==='proves'));
  assert.ok(result.topology.edges.some(edge=>['depends-on','requires'].includes(edge.type)));
  assert.equal(result.projectionRanking[0].type,'proof');
  assert.equal(result.selectedProjection.type,'proof');
  assert.equal(result.projection.kind,'derived-projection');
  assert.equal(result.projection.templateId,'builtin:proof-tree');
  assert.equal(result.projection.ephemeral,true);
  assert.equal(fixture.state.structureInstances.length,0);
  assert.ok(result.projection.instance.overrides.addedSlots.some(slot=>['goal','conclusion'].includes(slot.role)));
  assert.ok(result.projection.instance.overrides.addedSlots.some(slot=>['premise','definition','known-theorem'].includes(slot.role)));
  assert.ok(result.projection.instance.overrides.addedEdges.every(edge=>edge.relationType!=='activated-with'));
  assert.ok(result.projection.instance.overrides.addedEdges.some(edge=>edge.relationType==='proves'));

  const saved=persistDerivedProjection(result.projection,{ownerKnowledgeId:fixture.goal.id});
  assert.equal(saved.runtimeMetadata.cognitiveProjection.persistence,'persistent');
  assert.equal(validateInstance(saved,fixture.state.structureTemplates,[saved],fixture.state.knowledge).valid,true);
  assert.deepEqual(fixture.state.knowledge,before);
  assert.equal(result.validation.status,'complete');
  assert.ok(result.validation.successCriteria.length>0);
  assert.ok(result.validation.transferSuggestions.length>0);
  assert.deepEqual(result.transferTests,result.plan.transferTests);
});

test('philosophy concept-understanding infers concept roles without producing a Proof Tree',()=>{
  const fixture=philosophyFixture(),before=structuredClone(fixture.state.knowledge),taskContext=createTaskContext({goal:'Understand competing ideas of political freedom',taskType:'concept-understanding',domainConstraints:['political philosophy'],focus:['freedom','distinction','objection']});
  const result=autoOrganizeKnowledge({taskContext,cue:'concept definition contrast premise consequence objection application',state:fixture.state,maxCandidates:7,maxRelationDepth:2}),roles=rolesFor(result);

  assert.ok(result.activation.activeKnowledgeIds.includes(fixture.concept.id));
  assert.ok(['target-concept','definition','concept'].includes(roles.get(fixture.concept.id)));
  assert.ok(['contrast','distinction'].includes(roles.get(fixture.distinction.id)));
  assert.equal(result.selectedProjection.type==='proof',false);
  assert.ok(['network','hierarchy','comparison','no-structure'].includes(result.selectedProjection.type));
  assert.notEqual(result.projection?.templateId,'builtin:proof-tree');
  assert.ok(result.topology.edges.some(edge=>edge.type==='contrasts-with'));
  assert.ok(result.topology.edges.some(edge=>edge.type==='objects-to'));
  assert.ok(result.projection?.instance?.overrides.addedEdges.every(edge=>edge.relationType!=='activated-with')??true);
  assert.ok(result.validation.successCriteria.length>0);
  assert.ok(Array.isArray(result.gaps));
  assert.ok(result.validation.transferSuggestions.every(item=>item.status==='suggested'));
  assert.deepEqual(fixture.state.knowledge,before);
});

test('the same mixed Knowledge base changes activation, roles and projection by Task and Domain',()=>{
  const mathematics=mathematicsFixture(),philosophy=philosophyFixture(),state=stateOf([...mathematics.state.knowledge,...philosophy.state.knowledge],[...mathematics.state.relations,...philosophy.state.relations]);
  const proof=autoOrganizeKnowledge({taskContext:createTaskContext({goal:'Prove Lagrange theorem',taskType:'proof-learning',domainConstraints:['abstract algebra'],focus:['cosets']}),cue:'theorem proof premise',state,maxCandidates:7});
  const concept=autoOrganizeKnowledge({taskContext:createTaskContext({goal:'Understand political freedom',taskType:'concept-understanding',domainConstraints:['philosophy'],focus:['distinction','objection']}),cue:'concept freedom contrast',state,maxCandidates:7});
  const proofSet=new Set(proof.activation.activeKnowledgeIds),conceptSet=new Set(concept.activation.activeKnowledgeIds);

  assert.ok(proofSet.has(mathematics.goal.id));
  assert.equal(proofSet.has(philosophy.concept.id),false);
  assert.ok(conceptSet.has(philosophy.concept.id));
  assert.equal(conceptSet.has(mathematics.goal.id),false);
  assert.notDeepEqual([...proofSet].sort(),[...conceptSet].sort());
  assert.notDeepEqual(proof.roles.map(item=>[item.knowledgeId,item.primaryRole]),concept.roles.map(item=>[item.knowledgeId,item.primaryRole]));
  assert.equal(proof.selectedProjection.type,'proof');
  assert.notEqual(concept.selectedProjection.type,'proof');
});

test('insufficient evidence rejects proof, DAG and LMN instead of inventing activated-with edges',()=>{
  const claim=knowledge('Standalone claim','Goal theorem without any recorded derivation.','theorem',['mathematics']),premise=knowledge('Standalone premise','A definition-like premise that is not yet related to the claim.','definition',['mathematics']),state=stateOf([claim,premise]),before=structuredClone(state.knowledge),taskContext=createTaskContext({goal:'Prove the standalone claim',taskType:'proof-learning',domainConstraints:['mathematics'],focus:['claim']});

  for(const projectionType of['proof','dependency','lmn']){
    const result=compileCognitiveTask({taskContext,cue:'claim premise',state,maxCandidates:2,projectionType,generateProjection:true});
    assert.equal(result.projection.kind,'no-structure');
    assert.equal(result.projection.instance,null);
    assert.equal(result.projection.status,'insufficient-semantic-topology');
    assert.equal(result.selectedProjection.eligible,false);
    assert.ok(result.gaps.some(gap=>gap.id==='missing-bridge'));
    assert.equal(result.topology.edges.some(edge=>edge.type==='activated-with'),false);
    assert.ok(['partial','insufficient-evidence'].includes(result.validation.status));
  }
  const automatic=autoOrganizeKnowledge({taskContext,cue:'claim premise',state,maxCandidates:2});
  assert.equal(automatic.selectedProjection.type,'no-structure');
  assert.equal(automatic.projection.kind,'no-structure');
  assert.deepEqual(state.knowledge,before);
});

test('natural-language domains map deterministically and unknown domains retain a general fallback constraint',()=>{
  const mathematics=resolveDomainInput(['我正在研究抽象代数与群论']),philosophy=resolveDomainInput(['政治哲学中的自由概念']),unknown=resolveDomainInput(['命理学紫微斗数']);
  assert.deepEqual(mathematics.profileIds,['mathematics']);
  assert.equal(mathematics.fallback,false);
  assert.ok(mathematics.localConstraints.includes('我正在研究抽象代数与群论'));
  assert.deepEqual(philosophy.profileIds,['philosophy']);
  assert.equal(philosophy.fallback,false);
  assert.deepEqual(unknown.profileIds,['general']);
  assert.equal(unknown.fallback,true);
  assert.ok(unknown.localConstraints.includes('命理学紫微斗数'));
});
