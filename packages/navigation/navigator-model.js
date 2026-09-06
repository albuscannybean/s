import {buildNavigatorIndex,searchNavigatorIndex} from './location-index.js';
export {buildNavigatorIndex,searchNavigatorIndex,navigatorObjectKey,navigatorExpansionKey,revealNavigatorTarget,flattenNavigator} from './location-index.js';
import {materializeInstanceDefinition} from '../structure-engine/model.js';
import {buildPositionIndex,containerItemLabel,containerSearchText} from '../domain/semantic-container.js';
import {structureNavigatorPresentation} from '../structure-engine/presentation-adapters.js';
import {getEffectiveTitle} from '../domain/identity.js';

export function structureNavigatorSummary(template,instance,definition=materializeInstanceDefinition(template,instance)){
  const index=buildPositionIndex(instance,definition);return structureNavigatorPresentation(template,instance,definition,index);
}

export function semanticNavigatorSearch(state,query,options={}){return searchNavigatorIndex(options.index??buildNavigatorIndex(state,options),query,options);}

export function cycleReferenceLabel(target,path=[]){return`↻ 引用：${target||path.at(-1)||'目标'}`}

export function navigatorKnowledgeRoots(state,index=buildNavigatorIndex(state)){
  return index.roots.filter(entry=>entry.kind==='knowledge').map(entry=>entry.record).sort((a,b)=>String(a.title??a.id).localeCompare(String(b.title??b.id),'zh-CN'));
}

export function navigatorStructureRoots(state,knowledgeId,index=buildNavigatorIndex(state)){
  const knowledge=index.find({kind:'knowledge',id:knowledgeId});if(!knowledge){const explicit=orderedConstructStructuresForKnowledge(state,knowledgeId);return explicit.length?explicit:(state.structureInstances??[]).filter(i=>i.ownerKnowledgeId===knowledgeId);}
  return(index.children.get(knowledge.key)??[]).filter(link=>link.canonical).map(link=>index.objects.get(link.child)).filter(entry=>entry.kind==='structure').map(entry=>entry.record);
}

export function orderedConstructStructuresForKnowledge(state,knowledgeId){
  const byId=new Map((state.structureInstances??[]).map(item=>[item.id,item])),seen=new Set();return(state.placements??[]).filter(item=>item.mode!=='reference'&&item.parentType==='knowledge'&&item.parentId===knowledgeId&&item.targetType==='structure'&&byId.has(item.targetId)).sort((a,b)=>Number(a.order??0)-Number(b.order??0)||String(a.stableId??a.id??'').localeCompare(String(b.stableId??b.id??''))).flatMap(item=>{if(seen.has(item.targetId))return[];seen.add(item.targetId);return[byId.get(item.targetId)]});
}

export function primaryStructureForKnowledge(state,knowledgeId){return orderedConstructStructuresForKnowledge(state,knowledgeId)[0]??(state.structureInstances??[]).find(item=>item.ownerKnowledgeId===knowledgeId&&item.templateId==='builtin:lmn-432')??(state.structureInstances??[]).find(item=>item.ownerKnowledgeId===knowledgeId)??null}

function placementMode(value){return value?.metadata?.placementMode==='reference'?'reference':'construct'}
function resolvePackageRoot(record,knowledge){const direct=[record?.rootKnowledgeId,record?.rootInternalId].find(id=>knowledge.some(item=>item.id===id));if(direct)return direct;if(record?.root?.type!=='knowledge'||!record.root.id)return null;const stableId=record.root.id,packageId=record.packageId??record.stableId;return knowledge.find(item=>item.id===stableId||item.stableId===stableId&&(!packageId||item.packageId===packageId)||item.externalStableId===`${packageId}/knowledge:${stableId}`)?.id??null}

function matches(needle,...values){return values.some(value=>String(value??'').toLowerCase().includes(needle))}
