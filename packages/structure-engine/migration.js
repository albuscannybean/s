import {BUILTIN_TEMPLATES,LMN_TEMPLATE} from './templates.js';

export function migrateV2ToV3(v2){
  if((v2.schemaVersion??v2.schema_version)===3)return structuredClone(v2);
  const lmns=v2.lmns??[],existingInstances=v2.structureInstances??[];
  const migrated=lmns.map(l=>({id:l.id,templateId:LMN_TEMPLATE.id,templateVersion:LMN_TEMPLATE.version,ownerKnowledgeId:l.knowledgeId,bindings:Object.values(l.positions??{}).filter(p=>p.knowledgeId).map((p,i)=>({id:`migration:${l.id}:${p.position}:${i}`,instanceId:l.id,slotId:p.position,targetType:'knowledge',targetId:p.knowledgeId,metadata:{migratedFrom:'v2-lmn'},createdAt:l.createdAt,updatedAt:l.updatedAt})),parameters:{},runtimeState:{variables:{},results:{},errors:{}},layoutState:{visualOffsets:{},collapsedSlots:[]},createdAt:l.createdAt,updatedAt:l.updatedAt,migration:{source:'v2-lmn'}}));
  return{schemaVersion:3,application:'LMN Knowledge System',knowledge:structuredClone(v2.knowledge??[]),relations:structuredClone(v2.relations??[]),representations:structuredClone(v2.representations??[]),structureTemplates:mergeById(BUILTIN_TEMPLATES,v2.structureTemplates??[]),structureInstances:mergeById(existingInstances,migrated),legacy:{lmns:structuredClone(lmns),structures:structuredClone(v2.structures??[])},migration:{from:Number(v2.schema_version??2),to:3,at:new Date().toISOString()}};
}
function mergeById(a,b){return[...new Map([...a,...b].map(x=>[x.id,structuredClone(x)])).values()]}

export function validateV3Bundle(bundle){
  const errors=[];if(bundle?.schemaVersion!==3)errors.push('schemaVersion must be 3');for(const k of['knowledge','relations','structureTemplates','structureInstances'])if(!Array.isArray(bundle?.[k]))errors.push(`${k} must be an array`);
  const knowledge=new Set((bundle?.knowledge??[]).map(x=>x.id)),templates=new Set((bundle?.structureTemplates??[]).map(x=>x.id)),instances=new Set((bundle?.structureInstances??[]).map(x=>x.id));
  for(const r of bundle?.relations??[])if(!knowledge.has(r.sourceId)||!knowledge.has(r.targetId))errors.push(`dangling relation ${r.id}`);
  for(const i of bundle?.structureInstances??[]){if(!templates.has(i.templateId))errors.push(`instance ${i.id} has missing template`);for(const b of i.bindings??[]){if(b.targetType==='knowledge'&&!knowledge.has(b.targetId))errors.push(`binding ${b.id} has missing Knowledge`);if(b.targetType==='structure'&&!instances.has(b.targetId))errors.push(`binding ${b.id} has missing Structure`)}}
  return{valid:!errors.length,errors};
}
