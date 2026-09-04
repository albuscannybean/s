const normalize=value=>String(value??'').normalize('NFKC').toLowerCase();
const unique=value=>[...new Set((value??[]).filter(Boolean))];
const textOf=knowledge=>normalize([knowledge?.title,knowledge?.content,knowledge?.summary,knowledge?.objectContent?.title,knowledge?.objectContent?.summary,knowledge?.objectContent?.body,knowledge?.objectContent?.tags,knowledge?.aliases].flat().filter(Boolean).join(' '));
const typeOf=knowledge=>normalize(knowledge?.objectContent?.contentType??knowledge?.contentType??'note');

const KEYWORDS=Object.freeze({
  goal:['goal','claim','conclusion','target','目标','命题','结论'],premise:['premise','assumption','given','前提','假设','已知'],definition:['definition','define','定义'],prerequisite:['prerequisite','prior','先修','前置'],
  'known-theorem':['theorem','定理'],lemma:['lemma','引理'],bridge:['bridge','intermediate','桥梁','中间'],proof:['proof','demonstration','证明'],'proof-method':['method','strategy','induction','contradiction','方法','策略','归纳','反证'],
  example:['example','例子','示例'],counterexample:['counterexample','反例'],boundary:['boundary','limit','condition','边界','条件','限制'],application:['application','apply','应用'],consequence:['consequence','implication','result','后果','推论','结果'],
  'target-concept':['concept','概念'],contrast:['contrast','difference','distinction','区别','区分','对照'],problem:['problem','question','问题'],concept:['concept','概念'],distinction:['distinction','区分'],commitment:['commitment','承诺'],objection:['objection','critique','异议','反驳','批评'],revision:['revision','修正'],
  source:['source','passage','work','原文','文本','作品'],context:['context','background','语境','背景'],interpretation:['interpretation','reading','阐释','解读'],motif:['motif','theme','意象','主题'],
  'comparison-dimension':['dimension','criterion','维度','标准'],similarity:['similarity','same','相似','共同'],difference:['difference','differ','差异','不同'],condition:['condition','if','条件','如果'],outcome:['outcome','result','结果'],
  essence:['essence','本质'],existence:['existence','存在'],existential:['existential','existent','存在者'],language:['language','语言'],construction:['construction','construct','构造'],realization:['realization','realize','实现'],symbolization:['symbolization','symbolize','符号化'],structuring:['structuring','structure','结构化']
});

const CONTENT_ROLES=Object.freeze({definition:['definition'],theorem:['known-theorem'],proof:['proof','proof-method'],example:['example','application'],counterexample:['counterexample','boundary'],reference:['source','context'],formula:['expression']});
const TASK_ROLE_PRIORITY=Object.freeze({
  'proof-learning':['goal','premise','definition','known-theorem','lemma','bridge','proof-method','proof','counterexample','boundary','conclusion'],
  'concept-understanding':['target-concept','definition','contrast','example','counterexample','prerequisite','consequence','application','boundary'],
  comparison:['object-a','object-b','comparison-dimension','similarity','difference','boundary'],
  interpretation:['source','context','concept','motif','distinction','interpretation','objection','consequence'],
  explanation:['target','cause','context','mechanism','example','consequence','boundary']
});

export function inferCognitiveRoles({cognitivePlan={},activation={},state={},taskContext={}}={}){
  const activeSet=new Set(activation.activeKnowledgeIds??[]),knowledgeById=new Map((state.knowledge??[]).map(item=>[item.id,item])),scores=new Map(),evidence=new Map();
  const add=(id,role,score,reason)=>{if(!activeSet.has(id)||!role||score<=0)return;if(!scores.has(id))scores.set(id,new Map());scores.get(id).set(role,(scores.get(id).get(role)??0)+score);if(!evidence.has(id))evidence.set(id,new Map());if(!evidence.get(id).has(role))evidence.get(id).set(role,new Set());evidence.get(id).get(role).add(reason)};
  for(const candidate of activation.candidates??[])for(const hint of candidate.roleHints??[])add(candidate.knowledgeId,hint.role,Math.min(3,hint.score*.1),`retrieval intent: ${hint.role}`);
  const taskId=cognitivePlan.taskSchema?.id??taskContext.taskType??'concept-understanding',priority=TASK_ROLE_PRIORITY[taskId]??cognitivePlan.requiredRoles??[];
  const goalTerms=unique([taskContext.goal,...(taskContext.focus??[])]).flatMap(value=>normalize(value).split(/[^\p{L}\p{N}]+/u)).filter(term=>term.length>1);
  for(const id of activeSet){
    const knowledge=knowledgeById.get(id);if(!knowledge)continue;const text=textOf(knowledge),type=typeOf(knowledge);
    for(const role of CONTENT_ROLES[type]??[])add(id,role,8,`contentType=${type}`);
    if(taskId==='proof-learning'){
      if(type==='definition')add(id,'premise',4,'definitions can ground a proof');
      if(type==='theorem')add(id,'premise',3,'theorem can serve as a proof premise');
      if(type==='proof')add(id,'proof',5,'proof content supplies derivation evidence');
    }
    if(taskId==='concept-understanding'&&type==='definition')add(id,'target-concept',5,'definition identifies a concept target');
    if(taskId==='interpretation'&&['note','reference'].includes(type))add(id,type==='reference'?'source':'interpretation',3,'interpretive content type');
    for(const role of unique([...(cognitivePlan.requiredRoles??[]),...Object.keys(KEYWORDS)]))for(const keyword of KEYWORDS[role]??[])if(text.includes(normalize(keyword))){add(id,role,2,`text signal: ${keyword}`);break}
    const goalMatches=goalTerms.filter(term=>text.includes(term)).length;if(goalMatches){const ratio=goalMatches/Math.max(1,goalTerms.length);add(id,taskId==='concept-understanding'?'target-concept':'goal',4+ratio*7,'matches current goal/focus')}
  }
  for(const relationId of activation.activeRelationIds??[]){
    const relation=(state.relations??[]).find(item=>item.id===relationId);if(!relation)continue;const type=normalize(relation.type),source=relation.sourceId,target=relation.targetId,why=`relation ${relation.type}`;
    if(['proves','proof-of'].includes(type)){add(source,'proof',9,why);add(source,'proof-method',5,why);add(target,'goal',8,why);add(target,'conclusion',7,why);add(target,'known-theorem',5,why)}
    if(['depends-on','requires','prerequisite','uses'].includes(type)){add(source,taskId==='proof-learning'?'goal':'dependent',3,why);add(target,taskId==='proof-learning'?'premise':'prerequisite',7,why);add(target,'prerequisite',5,why)}
    if(['implies','derives','entails'].includes(type)){add(source,'premise',6,why);add(target,'conclusion',7,why);if(taskId==='proof-learning')add(target,'goal',4,why)}
    if(['supports','evidence-for'].includes(type)){add(source,'premise',4,why);add(target,taskId==='proof-learning'?'goal':'target',4,why)}
    if(['defines','definition-of'].includes(type)){add(source,'definition',7,why);add(target,'target-concept',7,why)}
    if(['contrasts-with','differs-from','opposes'].includes(type)){add(source,'contrast',6,why);add(target,'contrast',6,why);add(source,'object-a',3,why);add(target,'object-b',3,why)}
    if(['example-of','instantiates'].includes(type)){add(source,'example',7,why);add(target,'target-concept',5,why)}
    if(['objects-to','refutes'].includes(type)){add(source,'objection',7,why);add(target,'concept',3,why)}
    if(['part-of','contains','generalizes','specializes','parent-of'].includes(type)){add(source,'hierarchy-member',4,why);add(target,'hierarchy-member',4,why)}
    if(['condition','branches-to','alternative'].includes(type)){add(source,'condition',6,why);add(target,'outcome',6,why)}
  }
  const roles=[];
  for(const id of activation.activeKnowledgeIds??[]){
    const ranked=[...(scores.get(id)?.entries()??[])].sort((a,b)=>b[1]-a[1]||(priority.indexOf(a[0])<0?999:priority.indexOf(a[0]))-(priority.indexOf(b[0])<0?999:priority.indexOf(b[0]))||a[0].localeCompare(b[0]));
    if(!ranked.length)ranked.push(['relevant-knowledge',1]);const maximum=ranked[0][1];
    roles.push({knowledgeId:id,primaryRole:ranked[0][0],roles:ranked.map(([role,score])=>({role,confidence:Number(Math.min(.99,.35+score/(Math.max(10,maximum)*1.6)).toFixed(3)),score:Number(score.toFixed(3)),evidence:[...(evidence.get(id)?.get(role)??[])]})),confidence:Number(Math.min(.99,.35+maximum/16).toFixed(3)),evidence:[...(evidence.get(id)?.get(ranked[0][0])??[])]});
  }
  const counts={};for(const item of roles)for(const role of item.roles.filter(entry=>entry.confidence>=.5).map(entry=>entry.role))counts[role]=(counts[role]??0)+1;
  return{taskContextId:taskContext.id??null,cognitivePlanId:cognitivePlan.id??null,roles,byKnowledgeId:Object.fromEntries(roles.map(item=>[item.knowledgeId,item])),counts};
}
