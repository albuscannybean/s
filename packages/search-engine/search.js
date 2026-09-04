import {materializeTemplate} from '../structure-engine/templates.js';
import {materializeInstanceDefinition} from '../structure-engine/model.js';
import {buildSemanticIndex} from '../cognitive-runtime/semantic-index.js';

const same=(a,b)=>String(a??'').toLowerCase()===String(b??'').toLowerCase();

export function textSearch(query,state){
  return buildSemanticIndex(state).search(query).map(hit=>({type:hit.kind,id:hit.id,title:hit.title,score:hit.score,knowledgeId:hit.knowledgeId,instanceId:hit.instanceId,reasons:hit.reasons}));
}

export function structureSearch(criteria,state){
  const templates=new Map(state.structureTemplates.map(template=>[template.id,template]));
  return state.structureInstances.filter(instance=>{
    const template=templates.get(instance.templateId);if(!template)return false;
    if(criteria.templateId&&!same(template.id,criteria.templateId)&&!same(template.name,criteria.templateId)&&!template.name.toLowerCase().includes(String(criteria.templateId).toLowerCase()))return false;
    const resolved=materializeInstanceDefinition(template,instance);
    if(criteria.slotId&&!resolved.slots.some(slot=>same(slot.id,criteria.slotId)))return false;
    if(criteria.role&&!resolved.slots.some(slot=>same(slot.role,criteria.role)))return false;
    if(criteria.modularIndex!=null&&criteria.modularIndex!==''&&!resolved.slots.some(slot=>slot.semanticCoordinate?.modularIndex===Number(criteria.modularIndex)))return false;
    if(criteria.relationType&&!resolved.edges.some(edge=>same(edge.relationType,criteria.relationType)))return false;
    return true;
  }).map(instance=>({type:'structure',id:instance.id,template:templates.get(instance.templateId),ownerKnowledgeId:instance.ownerKnowledgeId}));
}

export function patternSearch(pattern,state){
  const templates=new Map(state.structureTemplates.map(template=>[template.id,template])),hits=[];
  for(const instance of state.structureInstances){
    const template=templates.get(instance.templateId);if(!template)continue;
    const resolved=materializeInstanceDefinition(template,instance),slots=new Map(resolved.slots.map(slot=>[slot.id,slot])),bindings=new Map((instance.bindings??[]).map(binding=>[binding.slotId,binding]));
    const matches=resolved.edges.filter(edge=>(!pattern.relationType||same(edge.relationType,pattern.relationType))&&(!pattern.direction||same(edge.direction,pattern.direction))&&(!pattern.sourceRole||same(slots.get(edge.sourceSlotId)?.role,pattern.sourceRole)||same(slots.get(edge.sourceSlotId)?.label,pattern.sourceRole))&&(!pattern.targetRole||same(slots.get(edge.targetSlotId)?.role,pattern.targetRole)||same(slots.get(edge.targetSlotId)?.label,pattern.targetRole))&&(!pattern.sourceTargetId||bindings.get(edge.sourceSlotId)?.targetId===pattern.sourceTargetId)&&(!pattern.targetTargetId||bindings.get(edge.targetSlotId)?.targetId===pattern.targetTargetId));
    if(matches.length)hits.push({type:'pattern',instanceId:instance.id,templateId:template.id,edgeIds:matches.map(edge=>edge.id),ownerKnowledgeId:instance.ownerKnowledgeId});
  }
  return hits;
}
