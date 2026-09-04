const clone=value=>structuredClone(value);

export const BUILTIN_TASK_SCHEMAS=Object.freeze([
  {id:'concept-understanding',label:'概念理解',inputState:['concept','prior knowledge'],expectedCapability:['explain','distinguish','apply'],operations:['retrieve','compare','explain'],successCriteria:['accurate definition','meaningful relation'],failureModes:['isolated definition'],transferTest:['apply in a new context']},
  {id:'problem-solving',label:'问题求解',inputState:['problem','constraints'],expectedCapability:['derive solution'],operations:['decompose','retrieve','calculate','verify'],successCriteria:['valid result','traceable steps'],failureModes:['missing constraint'],transferTest:['solve a related problem']},
  {id:'proof-learning',label:'证明学习',inputState:['claim','premises'],expectedCapability:['construct proof'],operations:['activate premises','trace dependencies','derive'],successCriteria:['valid dependency chain'],failureModes:['circular reasoning'],transferTest:['adapt proof strategy']},
  {id:'calculation',label:'计算',inputState:['expression','parameters'],expectedCapability:['compute'],operations:['normalize','calculate','check'],successCriteria:['correct result'],failureModes:['domain error'],transferTest:['recalculate with changed parameters']},
  {id:'comparison',label:'比较',inputState:['objects','dimensions'],expectedCapability:['compare'],operations:['retrieve','align','contrast'],successCriteria:['shared dimensions'],failureModes:['category mismatch'],transferTest:['compare another pair']},
  {id:'explanation',label:'解释',inputState:['question','audience'],expectedCapability:['explain'],operations:['retrieve','organize','communicate'],successCriteria:['coherent account'],failureModes:['unsupported leap'],transferTest:['answer a follow-up']},
  {id:'interpretation',label:'阐释',inputState:['source','context'],expectedCapability:['interpret'],operations:['contextualize','relate','synthesize'],successCriteria:['source-grounded reading'],failureModes:['context loss'],transferTest:['interpret a parallel source']}
]);

export function resolveTaskSchema(id){return clone(BUILTIN_TASK_SCHEMAS.find(item=>item.id===id)??BUILTIN_TASK_SCHEMAS[0])}
export function composeTaskSchema(...schemas){const values=schemas.flat().filter(Boolean),base=resolveTaskSchema(values[0]?.id??values[0]??'concept-understanding');for(const item of values){const schema=typeof item==='string'?resolveTaskSchema(item):item;for(const field of['inputState','expectedCapability','operations','successCriteria','failureModes','transferTest'])base[field]=[...new Set([...(base[field]??[]),...(schema[field]??[])])]}base.id=values.map(item=>typeof item==='string'?item:item.id).filter(Boolean).join('+')||base.id;return base}
