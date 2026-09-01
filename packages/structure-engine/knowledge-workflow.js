import {createKnowledge,createRepresentation} from '../domain/core.js';
import {createStructureInstance} from './model.js';

export function createKnowledgeWorkspaceRecords(title,{withLmn=false,lmnTemplate=null}={}){
  const knowledge=createKnowledge(title);
  knowledge.summary='';
  knowledge.aliases=[];
  if(!withLmn)return{knowledge,structureInstances:[],representations:[]};
  if(!lmnTemplate)throw new Error('LMN template is required when withLmn is true');
  const instance=createStructureInstance(lmnTemplate,knowledge.id);
  return{
    knowledge,
    structureInstances:[instance],
    representations:[createRepresentation(knowledge.id,'structure',{instanceId:instance.id,root:true})]
  };
}
