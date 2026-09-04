import {resolveDomainInput} from './domain-profiles.js';
import {resolveTaskSchema} from './task-schemas.js';

const unique=value=>[...new Set((value??[]).flat().map(item=>String(item).trim()).filter(Boolean))];

const ROLE_CONTENT_TYPES=Object.freeze({
  goal:['theorem','formula','note'],premise:['definition','theorem','note'],definition:['definition'],prerequisite:['definition','theorem'],
  'known-theorem':['theorem'],lemma:['theorem'],'proof-method':['proof','note'],proof:['proof'],example:['example'],counterexample:['counterexample'],boundary:['counterexample','note'],
  'target-concept':['definition','note'],contrast:['note','counterexample'],application:['example','note'],consequence:['theorem','note'],
  problem:['note'],concept:['definition','note'],distinction:['definition','note'],objection:['counterexample','note'],revision:['note'],
  source:['reference','note'],context:['reference','note'],interpretation:['note'],motif:['note']
});

const ROLE_QUERY_TERMS=Object.freeze({
  goal:['goal','claim','conclusion','目标','命题','结论'],premise:['premise','assumption','前提','假设'],definition:['definition','定义'],prerequisite:['prerequisite','requires','先修','依赖'],
  'known-theorem':['theorem','定理'],'proof-method':['proof method','strategy','证明方法','策略'],proof:['proof','证明'],bridge:['bridge','lemma','桥梁','引理'],lemma:['lemma','引理'],
  example:['example','例'],counterexample:['counterexample','反例'],boundary:['boundary','condition','边界','条件'],contrast:['contrast','distinction','区别','对照'],
  'target-concept':['concept','definition','概念','定义'],application:['application','应用'],consequence:['consequence','implication','后果','推论'],
  problem:['problem','问题'],concept:['concept','概念'],distinction:['distinction','区分'],objection:['objection','异议','反驳'],revision:['revision','修正'],
  source:['source','text','原文','文本'],context:['context','语境','背景'],interpretation:['interpretation','阐释'],motif:['motif','theme','意象','主题'],
  'object-a':['object','对象'],'object-b':['object','对象'],'comparison-dimension':['dimension','维度'],similarity:['similarity','相似'],difference:['difference','差异']
});

const PROJECTION_TYPE_BY_TEMPLATE=Object.freeze({'builtin:proof-tree':'proof','builtin:dependency-dag':'dependency','builtin:decision-tree':'decision','builtin:tree':'hierarchy','builtin:directed-graph':'network','builtin:lmn-432':'lmn'});
const PROJECTION_TYPE_BY_HINT=Object.freeze({proof:'proof',dependency:'dependency',decision:'decision',hierarchy:'hierarchy',comparison:'comparison',network:'network','concept-network':'network'});

export function createRetrievalIntents(taskSchema,domainResolution,taskContext={}){
  const profile=domainResolution.profile,baseTerms=unique([taskContext.goal,taskContext.focus,domainResolution.localConstraints]);
  return(taskSchema.retrievalRoles??[]).map((role,index)=>({
    id:`intent:${taskSchema.id}:${role}`,
    role,
    priority:Math.max(1,100-index),
    queryTerms:unique([...baseTerms,...(ROLE_QUERY_TERMS[role]??[role]),...profile.vocabulary.slice(0,8)]),
    contentTypes:unique(ROLE_CONTENT_TYPES[role]??[]),
    relationTypes:unique([...(taskSchema.preferredRelationTypes??[]),...(profile.relationTypes??[])]),
    taskSchemaId:taskSchema.id,
    domainProfileIds:domainResolution.profileIds
  }));
}

export function createCognitivePlan({taskContext={},domain=null}={}){
  const taskSchema=resolveTaskSchema(taskContext.taskType),domainResolution=resolveDomainInput(domain??taskContext.domainConstraints??[]),profile=domainResolution.profile;
  const preferredRelationTypes=unique([...(taskSchema.preferredRelationTypes??[]),...(profile.relationTypes??[])]),requiredRoles=unique(taskSchema.retrievalRoles??[]);
  const projectionCandidates=unique([...(taskSchema.topologyHints??[]).map(item=>PROJECTION_TYPE_BY_HINT[item]).filter(Boolean),...(profile.preferredStructures??[]).map(item=>PROJECTION_TYPE_BY_TEMPLATE[item]).filter(Boolean),'network','no-structure']);
  return{
    id:`plan:${taskContext.id??taskSchema.id}`,
    taskContextId:taskContext.id??null,
    taskSchema,
    domainProfiles:domainResolution.profiles,
    domainResolution,
    operations:unique([...(taskSchema.operations??[]),...(profile.operations??[])]),
    retrievalIntents:createRetrievalIntents(taskSchema,domainResolution,taskContext),
    requiredRoles,
    preferredRelationTypes,
    evidenceRules:unique(profile.evidenceRules??[]),
    topologyHints:unique(taskSchema.topologyHints??[]),
    projectionCandidates,
    successCriteria:unique([...(taskSchema.successCriteria??[]),...(profile.successCriteria??[])]),
    failureModes:unique([...(taskSchema.failureModes??[]),...(profile.failureModes??[])]),
    transferTests:unique(taskSchema.transferTest??[])
  };
}

export const buildCognitivePlan=createCognitivePlan;
