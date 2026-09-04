import {directedTraversal,filterRelations,semanticNeighborhood} from '../domain/core.js';
import {createCognitivePlan} from './cognitive-plan.js';
import {buildSemanticIndex} from './semantic-index.js';

const normalize=value=>String(value??'').normalize('NFKC').toLowerCase();
const unique=value=>[...new Set((value??[]).filter(Boolean))];
const queryFor=(context,cue)=>[cue,context?.goal,context?.taskType,...(context?.domainConstraints??[]),...(context?.focus??[])].filter(Boolean).join(' ');
const contentOf=knowledge=>knowledge?.objectContent??{};
const knowledgeText=knowledge=>normalize([knowledge?.title,knowledge?.content,knowledge?.summary,contentOf(knowledge).title,contentOf(knowledge).summary,contentOf(knowledge).body,contentOf(knowledge).contentType,contentOf(knowledge).tags,knowledge?.aliases].flat().filter(Boolean).join(' '));

export function activateKnowledge({taskContext={},cue='',cognitivePlan=null,index=null,state={},maxCandidates=12,maxRelationDepth=2,relationTypes=null}={}){
  const plan=cognitivePlan??createCognitivePlan({taskContext}),semanticIndex=index??buildSemanticIndex(state),limit=Math.max(1,Number(maxCandidates)||12),scores=new Map(),reasons=new Map(),breakdown=new Map(),roleHints=new Map(),seedIds=[],directMatchIds=new Set(),explicitIds=new Set(taskContext.activeKnowledgeIds??[]);
  const add=(id,score,reason,kind='semantic-match',role=null)=>{
    if(!id||!Number.isFinite(score)||score<=0)return;scores.set(id,(scores.get(id)??0)+score);if(!reasons.has(id))reasons.set(id,new Set());reasons.get(id).add(reason);
    if(!breakdown.has(id))breakdown.set(id,{});breakdown.get(id)[kind]=(breakdown.get(id)[kind]??0)+score;
    if(role){if(!roleHints.has(id))roleHints.set(id,new Map());roleHints.get(id).set(role,(roleHints.get(id).get(role)??0)+score)};
  };
  const addHit=(hit,score,reason,kind,role)=>{
    const ids=hit.kind==='relation'?[hit.sourceId,hit.targetId]:[hit.kind==='knowledge'?hit.id:hit.knowledgeId];
    for(const id of ids.filter(Boolean)){add(id,score,reason,kind,role);seedIds.push(id)}
  };

  for(const id of taskContext.activeKnowledgeIds??[]){add(id,24,'任务上下文显式激活','explicit');seedIds.push(id)}
  const baseQuery=queryFor(taskContext,cue);
  for(const hit of semanticIndex.search(baseQuery,{limit:limit*4})){addHit(hit,hit.score,hit.reasons.join('、')||`${hit.kind} 匹配`,'semantic-match',null);for(const id of(hit.kind==='relation'?[hit.sourceId,hit.targetId]:[hit.kind==='knowledge'?hit.id:hit.knowledgeId]))if(id)directMatchIds.add(id)}

  for(const intent of plan.retrievalIntents??[]){
    const query=unique([cue,taskContext.goal,...(taskContext.focus??[]),...intent.queryTerms]).join(' ');
    for(const hit of semanticIndex.search(query,{limit:limit*2})){
      const typeMatch=!intent.contentTypes.length||intent.contentTypes.includes(hit.type)||intent.contentTypes.includes(contentOf((state.knowledge??[]).find(item=>item.id===(hit.knowledgeId??hit.id))).contentType);
      const roleScore=Math.min(5,1.5+hit.score*.16)+(typeMatch?2:0);addHit(hit,roleScore,`定向检索：${intent.role}`,'task-relevance',intent.role);
    }
  }

  const profile=plan.domainResolution?.profile??{},wantedTypes=new Set([...(profile.canonicalObjects??[]),...(plan.retrievalIntents??[]).flatMap(item=>item.contentTypes??[])]),localTerms=unique([...(profile.vocabulary??[]),...(profile.localConstraints??[])]).map(normalize).filter(Boolean);
  for(const knowledge of state.knowledge??[]){
    const contentType=contentOf(knowledge).contentType??knowledge.contentType,text=knowledgeText(knowledge);
    const matchedTerms=localTerms.filter(term=>text.includes(term));if(matchedTerms.length)add(knowledge.id,Math.min(4,matchedTerms.length),`领域词汇：${matchedTerms.slice(0,3).join('、')}`,'domain-relevance');
    if(contentType&&!['note','custom'].includes(contentType)&&wantedTypes.has(contentType)&&(scores.has(knowledge.id)||matchedTerms.length))add(knowledge.id,3,`内容类型符合任务：${contentType}`,'content-type');
    if(scores.has(knowledge.id)&&(contentOf(knowledge).sources??knowledge.sources??[]).length)add(knowledge.id,.5,'具有来源依据','source-grounding');
  }

  const activeDomainIds=new Set((plan.domainResolution?.profileIds??[]).filter(id=>id!=='general')),domainTags={mathematics:new Set(['mathematics','math','数学']),philosophy:new Set(['philosophy','哲学']),literature:new Set(['literature','literary','文学'])};
  if(activeDomainIds.size)for(const knowledge of state.knowledge??[]){const tags=unique([...(contentOf(knowledge).tags??[]),...(knowledge.tags??[])]).map(normalize),declared=Object.entries(domainTags).filter(([,aliases])=>tags.some(tag=>aliases.has(tag))).map(([id])=>id);if(declared.length&&!declared.some(id=>activeDomainIds.has(id))&&!directMatchIds.has(knowledge.id)&&!explicitIds.has(knowledge.id)){scores.delete(knowledge.id);reasons.delete(knowledge.id);breakdown.delete(knowledge.id);roleHints.delete(knowledge.id)}}

  const preferredTypes=new Set(relationTypes??plan.preferredRelationTypes??[]),allRelations=filterRelations(state.relations??[],{types:relationTypes}),seed=[...new Set(seedIds)].filter(id=>scores.has(id)).sort((a,b)=>(scores.get(b)??0)-(scores.get(a)??0)).slice(0,limit);
  for(const id of seed){
    const neighborhood=semanticNeighborhood(state.knowledge??[],allRelations,id,maxRelationDepth);
    for(const node of neighborhood.nodes){if(node.id===id)continue;const distance=neighborhood.distanceById[node.id]??maxRelationDepth;add(node.id,Math.max(1,4-distance),`关系邻域：${id}`,'relation-relevance')}
    const forward=directedTraversal(allRelations,id,{direction:'outgoing',depth:maxRelationDepth});for(const targetId of forward.nodeIds)if(targetId!==id)add(targetId,2,`有向语义关系：${id}`,'relation-relevance');
  }
  for(const relation of allRelations){if(!scores.has(relation.sourceId)&&!scores.has(relation.targetId))continue;const bonus=preferredTypes.has(relation.type)?3:1;add(relation.sourceId,bonus,`关系类型：${relation.type}`,'relation-relevance');add(relation.targetId,bonus,`关系类型：${relation.type}`,'relation-relevance')}

  const candidates=[...scores].map(([id,activationScore])=>({knowledge:(state.knowledge??[]).find(item=>item.id===id),knowledgeId:id,activationScore:Number(activationScore.toFixed(3)),scoreBreakdown:breakdown.get(id)??{},roleHints:[...(roleHints.get(id)?.entries()??[])].sort((a,b)=>b[1]-a[1]).map(([role,score])=>({role,score:Number(score.toFixed(3))})),reasons:[...(reasons.get(id)??[])]})).filter(item=>item.knowledge).sort((a,b)=>b.activationScore-a.activationScore||String(a.knowledge.title).localeCompare(String(b.knowledge.title))).slice(0,limit);
  const activeKnowledgeIds=candidates.map(item=>item.knowledgeId),activeSet=new Set(activeKnowledgeIds),activeRelations=allRelations.filter(item=>activeSet.has(item.sourceId)&&activeSet.has(item.targetId));
  return{taskContextId:taskContext.id??null,cognitivePlanId:plan.id??null,cue:String(cue),retrievalIntents:plan.retrievalIntents??[],candidates,activeKnowledgeIds,activeRelationIds:activeRelations.map(item=>item.id),activationScore:Object.fromEntries(candidates.map(item=>[item.knowledgeId,item.activationScore])),activationReasons:Object.fromEntries(candidates.map(item=>[item.knowledgeId,item.reasons])),scoreBreakdown:Object.fromEntries(candidates.map(item=>[item.knowledgeId,item.scoreBreakdown])),roleHints:Object.fromEntries(candidates.map(item=>[item.knowledgeId,item.roleHints]))};
}
