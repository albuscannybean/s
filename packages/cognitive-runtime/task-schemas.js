const clone=value=>structuredClone(value);
const unique=value=>[...new Set((value??[]).map(String).filter(Boolean))];

export const BUILTIN_TASK_SCHEMAS=Object.freeze([
  {id:'concept-understanding',label:'概念理解',inputState:['concept','prior knowledge'],expectedCapability:['explain','distinguish','apply'],operations:['identify-target','retrieve-definition','retrieve-prerequisites','find-contrast','find-example','find-boundary','connect-consequences','transfer'],successCriteria:['target identified','accurate definition','meaningful relation','example or application','boundary recognized'],failureModes:['isolated definition','missing distinction','unsupported relation'],transferTest:['apply concept in a new context'],retrievalRoles:['target-concept','definition','prerequisite','contrast','example','counterexample','consequence','application','boundary'],preferredRelationTypes:['defines','depends-on','contrasts-with','example-of','applies-to','implies','related'],topologyHints:['concept-network','hierarchy','comparison']},
  {id:'problem-solving',label:'问题求解',inputState:['problem','constraints'],expectedCapability:['derive solution'],operations:['identify-goal','identify-constraints','decompose','retrieve-method','calculate','verify','transfer'],successCriteria:['goal identified','valid result','traceable steps'],failureModes:['missing constraint','unsupported step'],transferTest:['solve a related problem'],retrievalRoles:['goal','constraint','method','premise','intermediate-result','solution','boundary'],preferredRelationTypes:['depends-on','requires','derives','implies','supports'],topologyHints:['dependency','decision','network']},
  {id:'proof-learning',label:'证明学习',inputState:['claim','premises'],expectedCapability:['construct proof'],operations:['identify-goal','retrieve-premises','retrieve-definitions','retrieve-supporting-theorems','trace-dependencies','identify-bridge','derive','verify','transfer'],successCriteria:['goal identified','premises identified','valid dependency chain','conclusion reachable','no unsupported jump'],failureModes:['circular reasoning','hidden assumption','missing bridge','unsupported jump'],transferTest:['adapt proof strategy to a related claim'],retrievalRoles:['goal','premise','definition','known-theorem','lemma','bridge','proof-method','proof','counterexample','boundary','conclusion'],preferredRelationTypes:['depends-on','requires','prerequisite','implies','proves','derives','supports'],topologyHints:['proof','dependency']},
  {id:'calculation',label:'计算',inputState:['expression','parameters'],expectedCapability:['compute'],operations:['identify-expression','normalize','retrieve-rule','calculate','check-domain','verify'],successCriteria:['correct result','valid domain'],failureModes:['domain error','calculation error'],transferTest:['recalculate with changed parameters'],retrievalRoles:['expression','parameter','rule','method','result','boundary'],preferredRelationTypes:['depends-on','derives','uses','constrains'],topologyHints:['dependency','network']},
  {id:'comparison',label:'比较',inputState:['objects','dimensions'],expectedCapability:['compare'],operations:['identify-objects','retrieve-dimensions','align','find-similarities','find-differences','identify-boundaries'],successCriteria:['two or more objects','shared dimensions','traceable contrasts'],failureModes:['category mismatch','missing dimension'],transferTest:['compare another pair'],retrievalRoles:['object-a','object-b','comparison-dimension','similarity','difference','boundary'],preferredRelationTypes:['contrasts-with','similar-to','compares','shares','differs-from'],topologyHints:['comparison','network']},
  {id:'explanation',label:'解释',inputState:['question','audience'],expectedCapability:['explain'],operations:['identify-question','retrieve-causes','retrieve-context','organize','communicate','verify-support'],successCriteria:['coherent account','supported connection'],failureModes:['unsupported leap','missing context'],transferTest:['answer a follow-up'],retrievalRoles:['target','cause','context','mechanism','example','consequence','boundary'],preferredRelationTypes:['explains','causes','depends-on','supports','example-of'],topologyHints:['network','dependency']},
  {id:'interpretation',label:'阐释',inputState:['source','context'],expectedCapability:['interpret'],operations:['identify-source','retrieve-context','identify-motif','relate','contrast','synthesize','verify-grounding'],successCriteria:['source-grounded reading','context preserved'],failureModes:['context loss','unsupported reading'],transferTest:['interpret a parallel source'],retrievalRoles:['source','context','concept','motif','distinction','interpretation','objection','consequence'],preferredRelationTypes:['references','part-of','contrasts-with','develops','echoes','supports'],topologyHints:['network','hierarchy','comparison']}
]);

const TASK_ALIASES=Object.freeze({
  '概念理解':'concept-understanding','理解':'concept-understanding','concept':'concept-understanding',
  '问题求解':'problem-solving','求解':'problem-solving','solve':'problem-solving',
  '证明学习':'proof-learning','证明':'proof-learning','proof':'proof-learning',
  '计算':'calculation','calculate':'calculation',
  '比较':'comparison','compare':'comparison',
  '解释':'explanation','explain':'explanation',
  '阐释':'interpretation','interpret':'interpretation'
});

export function resolveTaskSchema(id){
  const source=String(id??'concept-understanding').trim(),normalized=TASK_ALIASES[source]??TASK_ALIASES[source.toLowerCase()]??source;
  return clone(BUILTIN_TASK_SCHEMAS.find(item=>item.id===normalized)??BUILTIN_TASK_SCHEMAS[0]);
}

export function composeTaskSchema(...schemas){
  const values=schemas.flat().filter(Boolean),base=resolveTaskSchema(values[0]?.id??values[0]??'concept-understanding');
  for(const item of values){const schema=typeof item==='string'?resolveTaskSchema(item):item;for(const field of['inputState','expectedCapability','operations','successCriteria','failureModes','transferTest','retrievalRoles','preferredRelationTypes','topologyHints'])base[field]=unique([...(base[field]??[]),...(schema[field]??[])])}
  base.id=values.map(item=>typeof item==='string'?resolveTaskSchema(item).id:item.id).filter(Boolean).join('+')||base.id;return base;
}
