import {BUILTIN_TEMPLATES,LMN_TEMPLATE} from './templates.js';
import {normalizeInstance} from './model.js';

const clone=value=>structuredClone(value);
const mergeById=(a,b)=>[...new Map([...a,...b].map(item=>[item.id,clone(item)])).values()];
const currentTemplates=existing=>{const custom=(existing??[]).filter(template=>!template.builtin&&!String(template.id).startsWith('builtin:'));return mergeById(custom,BUILTIN_TEMPLATES)};

export function migrateV2ToV3(v2){
  if((v2.schemaVersion??v2.schema_version)===3)return clone(v2);const lmns=v2.lmns??[],existingInstances=v2.structureInstances??[];
  const migrated=lmns.map(lmn=>({id:lmn.id,templateId:LMN_TEMPLATE.id,templateVersion:LMN_TEMPLATE.version,ownerKnowledgeId:lmn.knowledgeId,bindings:Object.values(lmn.positions??{}).filter(position=>position.knowledgeId).map((position,index)=>({id:`migration:${lmn.id}:${position.position}:${index}`,instanceId:lmn.id,slotId:position.position,targetType:'knowledge',targetId:position.knowledgeId,metadata:{migratedFrom:'v2-lmn'},createdAt:lmn.createdAt,updatedAt:lmn.updatedAt})),parameters:{},runtimeState:{variables:{},results:{},errors:{}},layoutState:{visualOffsets:{},collapsedSlots:[]},createdAt:lmn.createdAt,updatedAt:lmn.updatedAt,migration:{source:'v2-lmn'}}));
  return{schemaVersion:3,application:'LMN Knowledge System',knowledge:clone(v2.knowledge??[]),relations:clone(v2.relations??[]),representations:clone(v2.representations??[]),structureTemplates:mergeById(BUILTIN_TEMPLATES,v2.structureTemplates??[]),structureInstances:mergeById(existingInstances,migrated),legacy:{lmns:clone(lmns),structures:clone(v2.structures??[])},migration:{from:Number(v2.schema_version??2),to:3,at:new Date().toISOString()}};
}

export function migrateV3ToV4(v3){
  if(v3?.schemaVersion===4)return clone(v3);const source=v3?.schemaVersion===3?v3:migrateV2ToV3(v3),templates=currentTemplates(source.structureTemplates),templateMap=new Map(templates.map(template=>[template.id,template]));
  const instances=(source.structureInstances??[]).map(raw=>{const instance=normalizeInstance(clone(raw)),template=templateMap.get(instance.templateId);if(!instance.variables.length&&template?.variables)instance.variables=clone(template.variables);instance.templateVersion=template?.version??instance.templateVersion;return instance});
  return{...clone(source),schemaVersion:4,application:'LMN Knowledge System',structureTemplates:templates,structureInstances:instances,migration:{from:source.schemaVersion??3,to:4,at:new Date().toISOString(),preservedIds:true}};
}

export function migrateAnyToV4(value){return value?.schemaVersion===4?clone(value):migrateV3ToV4(value)}

export function validateV3Bundle(bundle){const copy=bundle?.schemaVersion===4?{...bundle,schemaVersion:3}:bundle;const errors=[];if(copy?.schemaVersion!==3)errors.push('schemaVersion must be 3');for(const key of['knowledge','relations','structureTemplates','structureInstances'])if(!Array.isArray(copy?.[key]))errors.push(`${key} must be an array`);return finishValidation(copy,errors)}
export function validateV4Bundle(bundle){const errors=[];if(bundle?.schemaVersion!==4)errors.push('schemaVersion must be 4');for(const key of['knowledge','relations','structureTemplates','structureInstances'])if(!Array.isArray(bundle?.[key]))errors.push(`${key} must be an array`);return finishValidation(bundle,errors)}
function finishValidation(bundle,errors){const knowledge=new Set((bundle?.knowledge??[]).map(item=>item.id)),templates=new Set((bundle?.structureTemplates??[]).map(item=>item.id)),instances=new Set((bundle?.structureInstances??[]).map(item=>item.id));for(const relation of bundle?.relations??[])if(!knowledge.has(relation.sourceId)||!knowledge.has(relation.targetId))errors.push(`dangling relation ${relation.id}`);for(const instance of bundle?.structureInstances??[]){if(!templates.has(instance.templateId))errors.push(`instance ${instance.id} has missing template`);for(const binding of instance.bindings??[]){if(binding.targetType==='knowledge'&&!knowledge.has(binding.targetId))errors.push(`binding ${binding.id} has missing Knowledge`);if(binding.targetType==='structure'&&!instances.has(binding.targetId))errors.push(`binding ${binding.id} has missing Structure`)}}return{valid:!errors.length,errors}}
