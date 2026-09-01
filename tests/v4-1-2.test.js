import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledge,createRelation} from '../packages/domain/core.js';
import {addContainerContent,buildPositionIndex,containerBadges,ensureObjectContent,migrateStateContentModels,normalizeObjectContent,structuralParameterImpact} from '../packages/domain/semantic-container.js';
import {addInstanceEdge,addInstanceSlot,bindTarget,createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {containerCapabilities,getStructureInteractionAdapter,structureCreateActions} from '../packages/structure-engine/interaction-adapters.js';
import {analyzePoset,createPosetStarter} from '../packages/structure-engine/poset.js';
import {applyVariableScheme,ZI_WEI_BASIC_SCHEME} from '../packages/structure-engine/variable-schemes.js';
import {runInstance} from '../packages/structure-engine/evaluator.js';
import {structureNavigatorSummary} from '../packages/navigation/navigator-model.js';

test('Object Content normalizes mathematical content and keeps stable import identity metadata',()=>{
  const normalized=normalizeObjectContent({title:'拉格朗日定理',body:'设 $G$ 为有限群。',contentType:'theorem',tags:['群论'],externalKey:'theorem:lagrange',aiMetadata:{sourceId:'source-1',importBatchId:'batch-1',confidence:.91}});assert.equal(normalized.bodyFormat,'markdown');assert.equal(normalized.contentType,'theorem');assert.deepEqual(normalized.tags,['群论']);assert.equal(normalized.aiMetadata.importBatchId,'batch-1');const legacy={title:'旧笔记',content:'原始 Markdown'};ensureObjectContent(legacy);assert.equal(legacy.content,'原始 Markdown');assert.equal(legacy.objectContent.body,'原始 Markdown');const knowledge=createKnowledge('新知识','正文'),relation=createRelation(knowledge.id,'target');assert.equal(knowledge.objectContent.body,'正文');assert.equal(knowledge.objectContent.title,'新知识');assert.equal(relation.objectContent.contentType,'custom');
});

test('LMN positions are universal containers with multiple Knowledge, Structure, content and formula children',()=>{
  const lmn=getBuiltinTemplate('builtin:lmn-432'),hasse=getBuiltinTemplate('builtin:poset-hasse'),owner=createKnowledge('群论'),knowledgeA=createKnowledge('存在论'),knowledgeB=createKnowledge('必要性'),instance=createStructureInstance(lmn,owner.id),nested=createStructureInstance(hasse,owner.id,{starter:'blank'});bindTarget(instance,lmn,'L2','knowledge',knowledgeA.id);bindTarget(instance,lmn,'L2','knowledge',knowledgeB.id);bindTarget(instance,lmn,'L2','structure',nested.id);const definition=materializeInstanceDefinition(lmn,instance);addContainerContent(instance,'L2',{type:'content',content:{title:'存在说明',body:'存在赋予合法性。',contentType:'note'}},definition);addContainerContent(instance,'L2',{type:'formula',content:{title:'存在公式',body:'$\\exists x$',contentType:'custom'}},definition);const index=buildPositionIndex(instance,definition),badges=containerBadges(index.bySlotId.L2);assert.deepEqual(badges.counts,{knowledge:2,structure:1,content:1,variable:0,formula:1,link:0,attachment:0});assert.equal(badges.total,5);assert.equal(instance.bindings.length,3);
});

test('legacy bindings and slot notes migrate into the unified container without data loss',()=>{
  const template=getBuiltinTemplate('builtin:directed-graph'),target=createKnowledge('目标'),instance=createStructureInstance(template,null);instance.slotNotes={A:'旧位置正文'};instance.bindings.push({id:'legacy-binding',instanceId:instance.id,slotId:'A',targetType:'knowledge',targetId:target.id,metadata:{note:'引用说明'}});const state={knowledge:[target],relations:[],structureTemplates:[template],structureInstances:[instance]};migrateStateContentModels(state,current=>materializeInstanceDefinition(template,current));const children=instance.containers.A.children;assert.equal(children.some(item=>item.id==='legacy-note:A'&&item.content.body==='旧位置正文'),true);assert.equal(children.some(item=>item.metadata.bindingId==='legacy-binding'),true);assert.equal(instance.slotNotes.A,'旧位置正文');
});

test('Modular runtime variables project into residue containers while persistent content stays separate',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template,null,{modulus:12}),definition=materializeInstanceDefinition(template,instance);assert.equal(instance.variables.length,0);addContainerContent(instance,'mod-4',{type:'knowledge',targetId:'knowledge-a'},definition);instance.variables=[{id:'one',label:'变量一',kind:'derived',type:'integer',formula:'4',expression:{value:4},showOnCanvas:true},{id:'two',label:'变量二',kind:'derived',type:'integer',formula:'4',expression:{value:4},showOnCanvas:true}];runInstance(instance,definition);const index=buildPositionIndex(instance,definition),entry=index.bySlotId['mod-4'],badges=containerBadges(entry);assert.equal(entry.persistentChildren.length,1);assert.equal(entry.runtimeChildren.length,2);assert.equal(badges.counts.knowledge,1);assert.equal(badges.counts.variable,2);
});

test('structural parameter impact includes removed containers, bindings, layout and variable recalculation',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template,null,{modulus:12}),oldDefinition=materializeInstanceDefinition(template,instance);addContainerContent(instance,'mod-9',{type:'content',content:{title:'九的位置正文',body:'保留检查'}},oldDefinition);instance.layoutState.nodePositions['mod-9']={x:20,y:30};instance.bindings.push({id:'binding-nine',instanceId:instance.id,slotId:'mod-9',targetType:'knowledge',targetId:'knowledge-nine'});instance.variables=[{id:'x',label:'x',kind:'input',value:9}];const nextDefinition=materializeTemplate(template,{modulus:8}),impact=structuralParameterImpact(instance,oldDefinition,nextDefinition);assert.equal(impact.nodesRemoved.includes('mod-9'),true);assert.equal(impact.bindingsAffected.length,1);assert.equal(impact.containerContentAffected.some(item=>item.content?.title==='九的位置正文'),true);assert.deepEqual(impact.manualLayoutAffected,['mod-9']);assert.deepEqual(impact.variablesRecalculated,['x']);
});

test('structure interaction adapters preserve mathematical topology differences',()=>{
  const lmn=getBuiltinTemplate('builtin:lmn-432'),graph=getBuiltinTemplate('builtin:directed-graph'),poset=getBuiltinTemplate('builtin:poset-hasse'),boolean=getBuiltinTemplate('builtin:boolean-algebra');assert.equal(containerCapabilities(lmn,{id:'L2'}).canDeleteCanonicalObject,false);assert.equal(containerCapabilities(boolean,{id:'subset-3'}).canDeleteCanonicalObject,false);assert.equal(containerCapabilities(graph,{id:'A'}).canDeleteCanonicalObject,true);assert.equal(structureCreateActions(poset)[0].label,'添加元素');assert.equal(structureCreateActions(graph)[0].label,'添加节点');assert.equal(getStructureInteractionAdapter(poset).id,'poset');
});

test('Poset workbench starts blank, validates cycles, reduces transitive edges and derives bounds',()=>{
  const blank=createPosetStarter('blank');assert.equal(blank.slots.length,0);const diamond=createPosetStarter('diamond'),analysis=analyzePoset(diamond.slots,diamond.edges);assert.equal(analysis.valid,true);assert.equal(analysis.least,'bottom');assert.equal(analysis.greatest,'top');assert.equal(analysis.lattice,true);const chainSlots=[{id:'a'},{id:'b'},{id:'c'}],chainEdges=[{id:'ab',sourceSlotId:'a',targetSlotId:'b'},{id:'bc',sourceSlotId:'b',targetSlotId:'c'},{id:'ac',sourceSlotId:'a',targetSlotId:'c'}],chain=analyzePoset(chainSlots,chainEdges);assert.deepEqual(chain.reduction.map(item=>item.id).sort(),['ab','bc']);const cycle=analyzePoset(chainSlots,[...chainEdges,{id:'ca',sourceSlotId:'c',targetSlotId:'a'}]);assert.equal(cycle.valid,false);assert.match(cycle.errors[0],/有向环/);
});

test('presentation adapter exposes universal modular and Poset hierarchy summaries',()=>{
  const modularTemplate=getBuiltinTemplate('builtin:mod-n'),modular=createStructureInstance(modularTemplate,null,{modulus:6}),modularSummary=structureNavigatorSummary(modularTemplate,modular);assert.deepEqual(modularSummary.rows.map(item=>item.label),['参数','变量','位置']);assert.equal(modularSummary.rows[2].children.length,6);const posetTemplate=getBuiltinTemplate('builtin:poset-hasse'),poset=createStructureInstance(posetTemplate,null,{starter:'diamond'}),summary=structureNavigatorSummary(posetTemplate,poset);assert.deepEqual(summary.rows.map(item=>item.label),['元素','覆盖关系','性质']);assert.equal(summary.rows[0].children.length,4);
});
