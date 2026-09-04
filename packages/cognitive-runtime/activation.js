import {directedTraversal,filterRelations,semanticNeighborhood} from '../domain/core.js';
import {buildSemanticIndex} from './semantic-index.js';

const queryFor=(context,cue)=>[cue,context?.goal,context?.taskType,...(context?.domainConstraints??[]),...(context?.focus??[])].filter(Boolean).join(' ');

export function activateKnowledge({taskContext={},cue='',index=null,state={},maxCandidates=12,maxRelationDepth=2,relationTypes=null}={}){
  const semanticIndex=index??buildSemanticIndex(state),limit=Math.max(1,Number(maxCandidates)||12),scores=new Map(),reasons=new Map(),seedIds=[];
  const add=(id,score,reason)=>{if(!id)return;scores.set(id,(scores.get(id)??0)+score);if(!reasons.has(id))reasons.set(id,new Set());reasons.get(id).add(reason)};
  for(const id of taskContext.activeKnowledgeIds??[]){add(id,20,'任务上下文显式激活');seedIds.push(id)}
  for(const hit of semanticIndex.search(queryFor(taskContext,cue),{limit:limit*4})){const id=hit.kind==='knowledge'?hit.id:hit.knowledgeId;if(!id)continue;add(id,hit.score,hit.reasons.join('、')||`${hit.kind} 匹配`);seedIds.push(id)}
  const relations=filterRelations(state.relations??[],{types:relationTypes}),seed=[...new Set(seedIds)].slice(0,limit);for(const id of seed){const neighborhood=semanticNeighborhood(state.knowledge??[],relations,id,maxRelationDepth);for(const node of neighborhood.nodes){if(node.id===id)continue;add(node.id,Math.max(1,4-(neighborhood.distanceById[node.id]??maxRelationDepth)),`关系邻域：${id}`)}const forward=directedTraversal(relations,id,{direction:'outgoing',depth:maxRelationDepth});for(const targetId of forward.nodeIds)if(targetId!==id)add(targetId,2,`有向依赖：${id}`)}
  const candidates=[...scores].map(([id,activationScore])=>({knowledge:(state.knowledge??[]).find(item=>item.id===id),knowledgeId:id,activationScore,reasons:[...(reasons.get(id)??[])]})).filter(item=>item.knowledge).sort((a,b)=>b.activationScore-a.activationScore||a.knowledge.title.localeCompare(b.knowledge.title)).slice(0,limit);const activeKnowledgeIds=candidates.map(item=>item.knowledgeId),activeSet=new Set(activeKnowledgeIds),activeRelations=relations.filter(item=>activeSet.has(item.sourceId)&&activeSet.has(item.targetId));return{taskContextId:taskContext.id??null,cue:String(cue),candidates,activeKnowledgeIds,activeRelationIds:activeRelations.map(item=>item.id),activationScore:Object.fromEntries(candidates.map(item=>[item.knowledgeId,item.activationScore])),activationReasons:Object.fromEntries(candidates.map(item=>[item.knowledgeId,item.reasons]))};
}
