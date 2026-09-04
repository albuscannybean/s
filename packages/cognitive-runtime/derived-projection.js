import {addInstanceEdge,addInstanceSlot,bindTarget,createStructureInstance,normalizeInstance} from '../structure-engine/model.js';
import {createCognitivePlan} from './cognitive-plan.js';
import {inferCognitiveRoles} from './role-inference.js';
import {induceTopology,PROJECTION_TEMPLATES,rankProjectionCandidates} from './topology.js';

const uid=()=>globalThis.crypto?.randomUUID?.()??`projection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now=()=>new Date().toISOString();

export function projectionTemplateId(type='network'){return PROJECTION_TEMPLATES[type]??PROJECTION_TEMPLATES.network}

export function createNoStructureProjection({taskContext={},activation={},topology=null,projectionType='no-structure',recommendation=null,reason=null}={}){
  const message=reason??recommendation?.reason??'Insufficient semantic topology：没有足够的真实关系支持所请求的结构。';
  return{id:null,kind:'no-structure',status:'insufficient-semantic-topology',ephemeral:true,persisted:false,projectionType:'no-structure',requestedProjectionType:projectionType,templateId:null,taskContextId:taskContext.id??null,activeKnowledgeIds:activation.activeKnowledgeIds??[],activeRelationIds:activation.activeRelationIds??[],projectionReason:message,confidence:recommendation?.score??topology?.confidence??0,supportingRoles:recommendation?.supportingRoles??[],supportingRelations:recommendation?.supportingRelations??[],warnings:recommendation?.warnings??['未创建任何伪造关系'],instance:null};
}

export function createDerivedProjection({taskContext={},activation,state={},projectionType='network',parameters={},cognitivePlan=null,roleInference=null,topology=null,projectionRecommendation=null}={}){
  const plan=cognitivePlan??createCognitivePlan({taskContext}),roles=roleInference??inferCognitiveRoles({cognitivePlan:plan,activation,state,taskContext}),model=topology??induceTopology({cognitivePlan:plan,activation,roleInference:roles,state}),ranking=projectionRecommendation?[projectionRecommendation]:rankProjectionCandidates({cognitivePlan:plan,topology:model,roleInference:roles});
  const recommendation=projectionRecommendation??ranking.find(item=>item.type===projectionType);
  if(projectionType==='no-structure'||!recommendation?.eligible)return createNoStructureProjection({taskContext,activation,topology:model,projectionType,recommendation,reason:projectionType==='lmn'?'LMN projection not semantically justified':null});
  const templateId=projectionTemplateId(projectionType),template=(state.structureTemplates??[]).find(item=>item.id===templateId);if(!template)throw new Error(`Missing projection template ${templateId}`);
  const activeSet=new Set(activation.activeKnowledgeIds??[]),orderedIds=[...(model.ordering??[]),...(activation.activeKnowledgeIds??[])].filter((id,index,list)=>activeSet.has(id)&&list.indexOf(id)===index&&(state.knowledge??[]).some(item=>item.id===id));
  if(!orderedIds.length)return createNoStructureProjection({taskContext,activation,topology:model,projectionType,recommendation,reason:'Derived projection requires active Knowledge'});
  const supportedIds=new Set(recommendation.supportingRelations??[]),semanticEdges=(model.edges??[]).filter(edge=>!supportedIds.size||supportedIds.has(edge.id));
  if(!semanticEdges.length)return createNoStructureProjection({taskContext,activation,topology:model,projectionType,recommendation});
  const ownerKnowledgeId=orderedIds[0],instance=createStructureInstance(template,ownerKnowledgeId,parameters);instance.id=`projection:${uid()}`;instance.overrides.removedSlotIds=[...(template.slots??[]).map(item=>item.id)];instance.overrides.removedEdgeIds=[...(template.edges??[]).map(item=>item.id)];instance.objectContent.title=`派生投影 · ${taskContext.goal||projectionType}`;
  const slotByKnowledge=new Map();for(const[index,id]of orderedIds.entries()){
    const knowledge=state.knowledge.find(item=>item.id===id),inferred=roles.byKnowledgeId?.[id],slot=addInstanceSlot(instance,{id:`active-${index+1}`,label:knowledge?.title??id,role:inferred?.primaryRole??(index===0?'focus':'relevant-knowledge'),semanticCoordinate:{order:index,cognitiveRoles:(inferred?.roles??[]).map(item=>item.role)},accepts:['knowledge'],cardinality:'one'});slotByKnowledge.set(id,slot.id);bindTarget(instance,template,slot.id,'knowledge',id,{activationScore:activation.activationScore?.[id]??0,reasons:activation.activationReasons?.[id]??[],cognitiveRole:inferred?.primaryRole??null,roleConfidence:inferred?.confidence??null})
  }
  let edgeCount=0;for(const edge of semanticEdges){const sourceSlotId=slotByKnowledge.get(edge.sourceId),targetSlotId=slotByKnowledge.get(edge.targetId);if(sourceSlotId&&targetSlotId)addInstanceEdge(instance,sourceSlotId,targetSlotId,{id:`semantic-relation-${++edgeCount}`,direction:'directed',relationType:edge.type??'related',label:edge.label??''})}
  if(!edgeCount)return createNoStructureProjection({taskContext,activation,topology:model,projectionType,recommendation});
  const justification={projectionReason:recommendation.reason,confidence:recommendation.score,supportingRoles:recommendation.supportingRoles,supportingRelations:recommendation.supportingRelations,warnings:recommendation.warnings};
  instance.runtimeMetadata={...(instance.runtimeMetadata??{}),cognitiveProjection:{taskContextId:taskContext.id??null,cognitivePlanId:plan.id??null,projectionType,persistence:'runtime',generatedAt:now(),activeKnowledgeIds:orderedIds,activeRelationIds:semanticEdges.map(edge=>edge.id),...justification}};normalizeInstance(instance);
  return{id:instance.id,kind:'derived-projection',status:'generated',ephemeral:true,persisted:false,projectionType,templateId,taskContextId:taskContext.id??null,activeKnowledgeIds:orderedIds,activeRelationIds:semanticEdges.map(edge=>edge.id),...justification,instance};
}

export function persistDerivedProjection(projection,{ownerKnowledgeId=null}={}){
  if(!projection?.instance)throw new Error('A generated derived projection is required');const instance=structuredClone(projection.instance);instance.id=uid();instance.ownerKnowledgeId=ownerKnowledgeId??instance.ownerKnowledgeId;instance.createdAt=now();instance.updatedAt=instance.createdAt;instance.runtimeMetadata={...(instance.runtimeMetadata??{}),cognitiveProjection:{...(instance.runtimeMetadata?.cognitiveProjection??{}),persistence:'persistent',savedAt:instance.createdAt}};for(const binding of instance.bindings??[])binding.instanceId=instance.id;normalizeInstance(instance);return instance;
}
