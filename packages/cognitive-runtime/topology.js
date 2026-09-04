const normalize=value=>String(value??'').normalize('NFKC').toLowerCase();
const round=value=>Number(Math.max(0,Math.min(1,value)).toFixed(3));
const unique=value=>[...new Set((value??[]).filter(Boolean))];

export const PROJECTION_TEMPLATES=Object.freeze({network:'builtin:directed-graph',dependency:'builtin:dependency-dag',proof:'builtin:proof-tree',hierarchy:'builtin:tree',comparison:'builtin:directed-graph',decision:'builtin:decision-tree',lmn:'builtin:lmn-432','no-structure':null});

const TYPE_GROUPS=Object.freeze({
  proof:['proves','proof-of','implies','derives','entails','supports','depends-on','requires','prerequisite'],
  dependency:['depends-on','requires','prerequisite','uses'],
  hierarchy:['part-of','contains','generalizes','specializes','parent-of','is-a'],
  comparison:['contrasts-with','differs-from','similar-to','compares','shares'],
  decision:['condition','branches-to','alternative','leads-to'],
  feedback:['feedback','responds-to','revises','cycles-to'],
  lmn:['defines','exists-at','constructs','realizes','expresses','symbolizes','structures','desymbolizes','destructures']
});

function topologicalOrdering(nodeIds,edges){
  const indegree=new Map(nodeIds.map(id=>[id,0])),outgoing=new Map(nodeIds.map(id=>[id,[]]));
  for(const edge of edges){if(!indegree.has(edge.sourceId)||!indegree.has(edge.targetId))continue;indegree.set(edge.targetId,indegree.get(edge.targetId)+1);outgoing.get(edge.sourceId).push(edge.targetId)}
  const queue=[...nodeIds.filter(id=>indegree.get(id)===0)].sort(),order=[];while(queue.length){const id=queue.shift();order.push(id);for(const target of outgoing.get(id)??[]){indegree.set(target,indegree.get(target)-1);if(indegree.get(target)===0){queue.push(target);queue.sort()}}}
  return{ordering:order.length===nodeIds.length?order:[...nodeIds],cyclic:order.length!==nodeIds.length};
}

const roleNames=roleInference=>new Set((roleInference.roles??[]).flatMap(item=>item.roles?.filter(role=>role.confidence>=.5).map(role=>role.role)??[item.primaryRole]));
const relationGroup=(edges,group)=>edges.filter(edge=>TYPE_GROUPS[group].includes(normalize(edge.type)));
const hasAny=(roles,names)=>names.some(name=>roles.has(name));

export function detectCognitiveGaps({cognitivePlan={},roleInference={},edges=[],features={}}={}){
  const taskId=cognitivePlan.taskSchema?.id,roles=roleNames(roleInference),gaps=[];
  const add=(id,label,severity='warning',details='')=>gaps.push({id,label,severity,details});
  if(taskId==='proof-learning'){
    if(!hasAny(roles,['goal','conclusion']))add('missing-goal','Missing Goal','error','未识别出目标命题或结论。');
    if(!hasAny(roles,['premise','definition','known-theorem','lemma']))add('missing-premises','Missing Premise','error','未识别出可支持证明的前提。');
    if(!hasAny(roles,['proof','proof-method','bridge']))add('missing-proof-evidence','Missing Proof Evidence','warning','未识别出证明、证明方法或中间桥梁。');
    if((features.proofEdgeCount??0)<2)add('missing-bridge','Missing Bridge','error','目标与依据之间没有足够的真实 proves / implies / dependency 关系形成中间链；不会伪造跳步。');
    if(features.cyclic)add('circular-dependency','Circular Dependency','error','激活关系中存在循环，不能视为有效证明链。');
  }else if(taskId==='concept-understanding'){
    if(!hasAny(roles,['target-concept','concept']))add('missing-target-concept','Missing Target Concept','error','未识别出当前要理解的概念。');
    if(!roles.has('definition'))add('missing-definition','Missing Definition','warning','缺少定义。');
    if(!hasAny(roles,['contrast','distinction','counterexample']))add('missing-distinction','Missing Distinction','warning','缺少区别、对照或反例。');
    if(!hasAny(roles,['example','application']))add('missing-example','Missing Example or Application','warning','缺少示例或应用。');
    if(!hasAny(roles,['boundary','counterexample']))add('missing-boundary','Missing Boundary','warning','缺少适用边界。');
    if(!edges.length)add('isolated-concept','Incomplete Understanding Model','warning','相关知识之间尚无真实语义关系。');
  }else if(taskId==='comparison'){
    if(!hasAny(roles,['object-a'])||!hasAny(roles,['object-b']))add('missing-comparison-objects','Missing Comparison Objects','error','需要至少两个可区分的比较对象。');
    if(!hasAny(roles,['comparison-dimension','similarity','difference'])&&!features.comparisonEdgeCount)add('missing-comparison-dimension','Missing Comparison Dimension','error','缺少共同维度、相似性或差异关系。');
  }
  return gaps;
}

export function induceTopology({cognitivePlan={},activation={},roleInference={},state={}}={}){
  const activeIds=activation.activeKnowledgeIds??[],activeSet=new Set(activeIds),relationIds=new Set(activation.activeRelationIds??[]);
  const relations=(state.relations??[]).filter(relation=>activeSet.has(relation.sourceId)&&activeSet.has(relation.targetId)&&(relationIds.size===0||relationIds.has(relation.id)));
  const edges=relations.map(relation=>({id:relation.id,sourceId:relation.sourceId,targetId:relation.targetId,type:relation.type??'related',label:relation.label??'',semantic:true,confidence:(TYPE_GROUPS.proof.includes(normalize(relation.type))||TYPE_GROUPS.hierarchy.includes(normalize(relation.type)))?0.95:0.75,evidence:['persisted semantic relation']}));
  const ordered=topologicalOrdering(activeIds,edges),outdegree=new Map(activeIds.map(id=>[id,0]));for(const edge of edges)outdegree.set(edge.sourceId,(outdegree.get(edge.sourceId)??0)+1);
  const features={edgeCount:edges.length,proofEdgeCount:relationGroup(edges,'proof').length,dependencyEdgeCount:relationGroup(edges,'dependency').length,hierarchyEdgeCount:relationGroup(edges,'hierarchy').length,comparisonEdgeCount:relationGroup(edges,'comparison').length,decisionEdgeCount:relationGroup(edges,'decision').length,feedbackEdgeCount:relationGroup(edges,'feedback').length,lmnEdgeCount:relationGroup(edges,'lmn').length,branchCount:[...outdegree.values()].filter(value=>value>1).length,cyclic:ordered.cyclic};
  const nodes=activeIds.map((id,index)=>{const inferred=roleInference.byKnowledgeId?.[id]??roleInference.roles?.find(item=>item.knowledgeId===id);return{id,knowledgeId:id,primaryRole:inferred?.primaryRole??'relevant-knowledge',roles:inferred?.roles??[],confidence:inferred?.confidence??0.25,order:index}}),roles=roleNames(roleInference);
  const gaps=detectCognitiveGaps({cognitivePlan,roleInference,edges,features}),confidence=round((edges.length?Math.min(1,edges.length/Math.max(1,activeIds.length-1))*.55:.05)+(nodes.length?nodes.reduce((sum,node)=>sum+node.confidence,0)/nodes.length*.45:0));
  return{kind:'topology-model',taskContextId:cognitivePlan.taskContextId??null,nodes,edges,ordering:ordered.ordering,branches:[...outdegree].filter(([,count])=>count>1).map(([sourceId,count])=>({sourceId,count,targetIds:edges.filter(edge=>edge.sourceId===sourceId).map(edge=>edge.targetId)})),feedback:relationGroup(edges,'feedback').map(edge=>edge.id),confidence,gaps,features,semanticRoles:[...roles]};
}

function candidate(type,score,eligible,reason,{roles=[],relations=[],warnings=[]}={}){return{type,templateId:PROJECTION_TEMPLATES[type],score:round(score),eligible:Boolean(eligible),reason,supportingRoles:unique(roles),supportingRelations:unique(relations),warnings:unique(warnings)}}

export function rankProjectionCandidates({cognitivePlan={},topology={},roleInference={}}={}){
  const edges=topology.edges??[],features=topology.features??{},roles=roleNames(roleInference),taskId=cognitivePlan.taskSchema?.id,preferred=new Set(cognitivePlan.projectionCandidates??[]),taskBonus=type=>preferred.has(type)?0.08:0,ids=group=>relationGroup(edges,group).map(edge=>edge.id);
  const goal=hasAny(roles,['goal','conclusion']),premiseEvidence=hasAny(roles,['premise','definition','known-theorem','lemma']),derivationEvidence=hasAny(roles,['proof','proof-method','bridge']),proofEligible=Boolean((topology.nodes?.length??0)>=3&&goal&&premiseEvidence&&derivationEvidence&&(features.proofEdgeCount??0)>=2&&!features.cyclic);
  const dependencyEligible=Boolean(features.dependencyEdgeCount&&!features.cyclic),hierarchyEligible=Boolean(features.hierarchyEdgeCount),comparisonRoles=hasAny(roles,['object-a'])&&hasAny(roles,['object-b'])&&hasAny(roles,['comparison-dimension','similarity','difference','contrast']),comparisonEligible=Boolean(features.comparisonEdgeCount&&comparisonRoles),decisionRoles=roles.has('condition')&&roles.has('outcome'),decisionEligible=Boolean(features.decisionEdgeCount&&features.branchCount&&decisionRoles);
  const lmnRoles=['essence','existence','existential','language','definition','construction','realization','symbolization','structuring'],lmnEligible=lmnRoles.every(role=>roles.has(role))&&features.lmnEdgeCount>=8;
  const networkEligible=edges.length>0&&topology.nodes?.length>1;
  const specializedEdgeCount=(features.proofEdgeCount??0)+(features.dependencyEdgeCount??0)+(features.hierarchyEdgeCount??0)+(features.comparisonEdgeCount??0)+(features.decisionEdgeCount??0)+(features.lmnEdgeCount??0),results=[
    candidate('proof',(taskId==='proof-learning'?0.52:0.08)+Math.min(0.27,(features.proofEdgeCount??0)*0.09)+(goal?0.08:0)+(premiseEvidence&&derivationEvidence?0.06:0)+taskBonus('proof'),proofEligible,proofEligible?'检测到目标、前提、中间证明依据与至少两条真实证明/依赖关系。':'缺少目标、前提、中间证明依据或足够的真实证明链。',{roles:[...roles].filter(role=>['goal','conclusion','premise','definition','known-theorem','lemma','proof','proof-method','bridge'].includes(role)),relations:ids('proof'),warnings:features.cyclic?['证明关系存在循环']:[]}),
    candidate('dependency',((taskId==='proof-learning'||taskId==='problem-solving')?0.3:0.12)+Math.min(0.42,(features.dependencyEdgeCount??0)*0.14)+taskBonus('dependency'),dependencyEligible,dependencyEligible?'存在真实 depends-on / requires / prerequisite 关系且无环。':'没有足够的真实无环依赖关系。',{relations:ids('dependency'),warnings:features.cyclic?['依赖关系存在循环']:[]}),
    candidate('decision',(taskId==='problem-solving'?0.18:0.05)+Math.min(0.5,(features.decisionEdgeCount??0)*0.14)+(features.branchCount?0.16:0)+taskBonus('decision'),decisionEligible,decisionEligible?'检测到条件、分支与结果。':'缺少条件分支或替代结果。',{roles:[...roles].filter(role=>['condition','outcome'].includes(role)),relations:ids('decision')}),
    candidate('hierarchy',(taskId==='concept-understanding'?0.15:0.08)+Math.min(0.5,(features.hierarchyEdgeCount??0)*0.14)+taskBonus('hierarchy'),hierarchyEligible,hierarchyEligible?'存在稳定的包含、特化或部分关系。':'缺少稳定层级关系。',{relations:ids('hierarchy')}),
    candidate('comparison',(taskId==='comparison'?0.48:0.1)+Math.min(0.28,(features.comparisonEdgeCount??0)*0.1)+(comparisonRoles?0.12:0)+taskBonus('comparison'),comparisonEligible,comparisonEligible?'识别出比较对象、维度以及差异/相似关系。':'缺少比较对象、共同维度或真实比较关系。',{roles:[...roles].filter(role=>['object-a','object-b','comparison-dimension','similarity','difference','contrast'].includes(role)),relations:ids('comparison')}),
    candidate('lmn',Math.min(0.82,(features.lmnEdgeCount??0)*0.07)+(lmnEligible?0.1:0)+taskBonus('lmn'),lmnEligible,lmnEligible?'九类 LMN 语义角色与转换关系均有证据。':'LMN projection not semantically justified',{roles:[...roles].filter(role=>lmnRoles.includes(role)),relations:ids('lmn'),warnings:lmnEligible?[]:['不会随机填充 LMN 槽位']}),
    candidate('network',((taskId==='concept-understanding'||taskId==='interpretation')?0.24:0.12)+Math.min(0.45,edges.length*0.09)+taskBonus('network'),networkEligible,networkEligible?'激活知识之间存在可展示的真实语义关系。':'知识之间没有真实关系；关系视图不足以构成图。',{relations:edges.map(edge=>edge.id)}),
    candidate('no-structure',!edges.length?0.78:!specializedEdgeCount?0.42:0.12,true,edges.length?'保留 Knowledge + Relation 视图，避免不必要的持久结构。':'Insufficient semantic topology：没有真实关系，不生成结构。',{warnings:edges.length?[]:['未发现可支持拓扑的语义关系']})
  ];
  return results.sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type));
}
