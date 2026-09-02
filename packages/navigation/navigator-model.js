import {materializeInstanceDefinition} from '../structure-engine/model.js';
import {buildPositionIndex,containerItemLabel,containerSearchText} from '../domain/semantic-container.js';
import {structureNavigatorPresentation} from '../structure-engine/presentation-adapters.js';
import {getEffectiveTitle} from '../domain/identity.js';

export function structureNavigatorSummary(template,instance,definition=materializeInstanceDefinition(template,instance)){
  const index=buildPositionIndex(instance,definition);return structureNavigatorPresentation(template,instance,definition,index);
}

export function semanticNavigatorSearch(state,query){
  const needle=String(query??'').trim().toLowerCase();if(!needle)return[];const results=[];
  for(const knowledge of state.knowledge??[]){const knowledgePath=[knowledge.title],knowledgeContent=knowledge.objectContent??{};if(matches(needle,knowledge.title,knowledge.content,knowledgeContent.title,knowledgeContent.summary,knowledgeContent.body,...(knowledgeContent.tags??[])))results.push({kind:'knowledge',id:knowledge.id,label:knowledge.title,path:knowledgePath});for(const instance of(state.structureInstances??[]).filter(item=>item.ownerKnowledgeId===knowledge.id)){const template=(state.structureTemplates??[]).find(item=>item.id===instance.templateId);if(!template)continue;const structurePath=[...knowledgePath,template.name];if(matches(needle,template.name,template.description,instance.objectContent?.summary,instance.objectContent?.body))results.push({kind:'structure',id:instance.id,label:template.name,path:structurePath});for(const variable of instance.variables??[])if(matches(needle,variable.id,variable.label,variable.formula,variable.displayFormula,variable.objectContent?.summary,variable.objectContent?.body))results.push({kind:'variable',id:variable.id,instanceId:instance.id,label:variable.displayName??variable.label??'变量',path:[...structurePath,variable.kind==='derived'?'派生变量':'输入变量',variable.displayName??variable.label??'变量']});const definition=materializeInstanceDefinition(template,instance),index=buildPositionIndex(instance,definition);for(const slot of definition.slots){const entry=index.bySlotId[slot.id],container=entry?.container,title=getEffectiveTitle(slot,{kind:'slot',instance,state,container}),containerPath=[...structurePath,title];if(matches(needle,title,containerSearchText(container,entry?.children,state)))results.push({kind:'slot',id:slot.id,instanceId:instance.id,label:title,path:containerPath});for(const item of entry?.children??[])if(matches(needle,containerItemLabel(item,state),item.content?.summary,item.content?.body,...(item.content?.tags??[])))results.push({kind:'content',id:item.id,slotId:slot.id,instanceId:instance.id,label:containerItemLabel(item,state),path:[...containerPath,containerItemLabel(item,state)]})}}}
  return results.slice(0,80);
}

export function cycleReferenceLabel(target,path=[]){return`↻ 引用：${target||path.at(-1)||'目标'}`}

export function navigatorKnowledgeRoots(state){
  const knowledge=(state.knowledge??[]).filter(item=>item?.id),byId=new Map(knowledge.map(item=>[item.id,item]));if(!knowledge.length)return[];
  const graph=new Map(knowledge.map(item=>[item.id,new Set()]));
  for(const instance of state.structureInstances??[]){const ownerId=instance.ownerKnowledgeId;if(!byId.has(ownerId))continue;for(const binding of instance.bindings??[]){if(binding.targetType!=='knowledge'||placementMode(binding)!=='construct'||!byId.has(binding.targetId)||binding.targetId===ownerId)continue;graph.get(ownerId).add(binding.targetId)}}
  for(const placement of state.placements??[]){if(placement.mode==='reference'||placement.targetType!=='knowledge'||placement.parentType!=='structure'||!byId.has(placement.targetId))continue;const parent=(state.structureInstances??[]).find(item=>item.id===placement.parentId),ownerId=parent?.ownerKnowledgeId;if(byId.has(ownerId)&&placement.targetId!==ownerId)graph.get(ownerId).add(placement.targetId)}
  const roots=[],rootIds=new Set(),addRoot=id=>{if(byId.has(id)&&!rootIds.has(id)){rootIds.add(id);roots.push(byId.get(id))}};
  for(const record of state.knowledgePackages??[])addRoot(resolvePackageRoot(record,knowledge));
  const incoming=new Map(knowledge.map(item=>[item.id,0]));for(const targets of graph.values())for(const targetId of targets)incoming.set(targetId,(incoming.get(targetId)??0)+1);
  for(const item of knowledge)if(!incoming.get(item.id))addRoot(item.id);
  const covered=new Set(),cover=start=>{const stack=[start];while(stack.length){const id=stack.pop();if(covered.has(id))continue;covered.add(id);for(const target of graph.get(id)??[])stack.push(target)}};for(const root of roots)cover(root.id);
  for(const item of knowledge)if(!covered.has(item.id)){addRoot(item.id);cover(item.id)}
  return roots.sort((a,b)=>String(a.title??a.id).localeCompare(String(b.title??b.id),'zh-CN'));
}

export function navigatorStructureRoots(state,knowledgeId){
  const instances=state.structureInstances??[],byId=new Map(instances.map(item=>[item.id,item])),direct=orderedConstructStructuresForKnowledge(state,knowledgeId),explicitTargets=new Set((state.placements??[]).filter(item=>item.mode!=='reference'&&item.targetType==='structure').map(item=>item.targetId));
  if(direct.length)return direct;
  const owned=instances.filter(item=>item.ownerKnowledgeId===knowledgeId&&!explicitTargets.has(item.id));if(!owned.length)return[];const ownedIds=new Set(owned.map(item=>item.id)),incoming=new Set();
  for(const instance of instances)for(const binding of instance.bindings??[])if(binding.targetType==='structure'&&placementMode(binding)==='construct'&&ownedIds.has(binding.targetId))incoming.add(binding.targetId);
  const roots=owned.filter(item=>!incoming.has(item.id));return roots.length?roots:[owned[0]];
}

export function orderedConstructStructuresForKnowledge(state,knowledgeId){
  const byId=new Map((state.structureInstances??[]).map(item=>[item.id,item])),seen=new Set();return(state.placements??[]).filter(item=>item.mode!=='reference'&&item.parentType==='knowledge'&&item.parentId===knowledgeId&&item.targetType==='structure'&&byId.has(item.targetId)).sort((a,b)=>Number(a.order??0)-Number(b.order??0)||String(a.stableId??a.id??'').localeCompare(String(b.stableId??b.id??''))).flatMap(item=>{if(seen.has(item.targetId))return[];seen.add(item.targetId);return[byId.get(item.targetId)]});
}

export function primaryStructureForKnowledge(state,knowledgeId){return orderedConstructStructuresForKnowledge(state,knowledgeId)[0]??(state.structureInstances??[]).find(item=>item.ownerKnowledgeId===knowledgeId&&item.templateId==='builtin:lmn-432')??(state.structureInstances??[]).find(item=>item.ownerKnowledgeId===knowledgeId)??null}

function placementMode(value){return value?.metadata?.placementMode==='reference'?'reference':'construct'}
function resolvePackageRoot(record,knowledge){const direct=[record?.rootKnowledgeId,record?.rootInternalId].find(id=>knowledge.some(item=>item.id===id));if(direct)return direct;if(record?.root?.type!=='knowledge'||!record.root.id)return null;const stableId=record.root.id,packageId=record.packageId??record.stableId;return knowledge.find(item=>item.id===stableId||item.stableId===stableId&&(!packageId||item.packageId===packageId)||item.externalStableId===`${packageId}/knowledge:${stableId}`)?.id??null}

function matches(needle,...values){return values.some(value=>String(value??'').toLowerCase().includes(needle))}
