import {activateKnowledge} from './activation.js';
import {createCognitivePlan} from './cognitive-plan.js';
import {createDerivedProjection,createNoStructureProjection} from './derived-projection.js';
import {inferCognitiveRoles} from './role-inference.js';
import {induceTopology,rankProjectionCandidates} from './topology.js';
import {validateCognitiveCompilation} from './validation.js';

export function compileCognitiveTask({taskContext={},cue='',domain=null,state={},index=null,maxCandidates=12,maxRelationDepth=2,projectionType=null,generateProjection=false}={}){
  const plan=createCognitivePlan({taskContext,domain}),activation=activateKnowledge({taskContext,cue,cognitivePlan:plan,index,state,maxCandidates,maxRelationDepth}),roleInference=inferCognitiveRoles({cognitivePlan:plan,activation,state,taskContext}),topology=induceTopology({cognitivePlan:plan,activation,roleInference,state}),projectionRanking=rankProjectionCandidates({cognitivePlan:plan,topology,roleInference}),validation=validateCognitiveCompilation({cognitivePlan:plan,activation,roleInference,topology});
  const selectedProjection=(projectionType?projectionRanking.find(item=>item.type===projectionType):projectionRanking.find(item=>item.eligible))??projectionRanking.find(item=>item.type==='no-structure');
  let projection=null;if(generateProjection){projection=selectedProjection?.type==='no-structure'?createNoStructureProjection({taskContext,activation,topology,recommendation:selectedProjection}):createDerivedProjection({taskContext,activation,state,projectionType:selectedProjection?.type??projectionType??'network',cognitivePlan:plan,roleInference,topology,projectionRecommendation:selectedProjection});}
  return{kind:'cognitive-compilation',taskContext,taskSchema:plan.taskSchema,domainResolution:plan.domainResolution,plan,activation,roles:roleInference.roles,roleInference,topology,projectionRanking,gaps:topology.gaps,validation,transferTests:plan.transferTests,selectedProjection,projection};
}

export function autoOrganizeKnowledge(options={}){return compileCognitiveTask({...options,projectionType:null,generateProjection:true})}
export const compileCognitiveRuntime=compileCognitiveTask;
export const autoOrganize=autoOrganizeKnowledge;
