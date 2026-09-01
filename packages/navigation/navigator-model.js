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

function matches(needle,...values){return values.some(value=>String(value??'').toLowerCase().includes(needle))}
