import {materializeTemplate} from './templates.js';
const uid=()=>globalThis.crypto?.randomUUID?.()??`v3-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();

export function createStructureInstance(template,ownerKnowledgeId=null,parameters={}){
  const resolved=materializeTemplate(template,parameters),values=Object.fromEntries(resolved.parameters.map(p=>[p.id,parameters[p.id]??p.defaultValue]));
  return{id:uid(),templateId:template.id,templateVersion:template.version,ownerKnowledgeId,bindings:[],parameters:values,runtimeState:{variables:{},results:{},errors:{}},layoutState:{visualOffsets:{},collapsedSlots:[]},createdAt:now(),updatedAt:now()};
}
export function createBinding(instanceId,slotId,targetType,targetId,metadata={}){return{id:uid(),instanceId,slotId,targetType,targetId,metadata,createdAt:now(),updatedAt:now()}}
export function validateTemplate(template){
  const errors=[];if(!template?.id)errors.push('template.id is required');if(!template?.name)errors.push('template.name is required');if(!Array.isArray(template?.slots))errors.push('slots must be an array');if(!Array.isArray(template?.edges))errors.push('edges must be an array');
  const ids=new Set();for(const s of template?.slots??[]){if(!s.id)errors.push('slot.id is required');if(ids.has(s.id))errors.push(`duplicate slot ${s.id}`);ids.add(s.id);if(!Array.isArray(s.accepts)||!s.accepts.length)errors.push(`slot ${s.id} has no accepted target type`);if(!['one','many'].includes(s.cardinality))errors.push(`slot ${s.id} has invalid cardinality`)}
  for(const e of template?.edges??[]){if(!ids.has(e.sourceSlotId)||!ids.has(e.targetSlotId))errors.push(`edge ${e.id} has dangling slot`);if(!['undirected','directed','bidirectional','cyclic','conditional','derived'].includes(e.direction))errors.push(`edge ${e.id} has invalid direction`)}
  return{valid:!errors.length,errors};
}
export function validateInstance(instance,templates,allInstances=[],knowledge=[]){
  const errors=[],template=templates.find(t=>t.id===instance?.templateId);if(!template)return{valid:false,errors:[`missing template ${instance?.templateId}`]};const resolved=materializeTemplate(template,instance.parameters),slots=new Map(resolved.slots.map(s=>[s.id,s])),knowledgeIds=new Set(knowledge.map(k=>k.id)),instanceIds=new Set(allInstances.map(x=>x.id));
  for(const b of instance.bindings??[]){const s=slots.get(b.slotId);if(!s){errors.push(`binding ${b.id} references missing slot ${b.slotId}`);continue}if(!s.accepts.includes(b.targetType))errors.push(`slot ${b.slotId} does not accept ${b.targetType}`);if(b.targetType==='knowledge'&&!knowledgeIds.has(b.targetId))errors.push(`binding ${b.id} references missing Knowledge`);if(b.targetType==='structure'&&!instanceIds.has(b.targetId))errors.push(`binding ${b.id} references missing Structure`)}
  for(const s of resolved.slots.filter(s=>s.cardinality==='one'))if((instance.bindings??[]).filter(b=>b.slotId===s.id).length>1)errors.push(`slot ${s.id} accepts only one binding`);return{valid:!errors.length,errors};
}
export function bindTarget(instance,template,slotId,targetType,targetId,metadata={}){
  const resolved=materializeTemplate(template,instance.parameters),slot=resolved.slots.find(s=>s.id===slotId);if(!slot)throw new Error(`Unknown slot ${slotId}`);if(!slot.accepts.includes(targetType))throw new Error(`${slotId} does not accept ${targetType}`);if(slot.cardinality==='one')instance.bindings=instance.bindings.filter(b=>b.slotId!==slotId);const binding=createBinding(instance.id,slotId,targetType,targetId,metadata);instance.bindings.push(binding);instance.updatedAt=now();return binding;
}
export function removeBinding(instance,bindingId){instance.bindings=instance.bindings.filter(b=>b.id!==bindingId);instance.updatedAt=now()}
export function nestedStructureCycle(instances,rootId,targetId){const byId=new Map(instances.map(x=>[x.id,x]));const seen=new Set();function visit(id){if(id===rootId)return true;if(seen.has(id))return false;seen.add(id);const current=byId.get(id);return(current?.bindings??[]).filter(b=>b.targetType==='structure').some(b=>visit(b.targetId))}return visit(targetId)}
export function cloneInstance(instance,ownerKnowledgeId=instance.ownerKnowledgeId){return{...structuredClone(instance),id:uid(),ownerKnowledgeId,bindings:instance.bindings.map(b=>({...b,id:uid()})),createdAt:now(),updatedAt:now()}}
