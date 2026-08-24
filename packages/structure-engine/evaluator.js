const numeric=v=>{if(typeof v!=='number'||!Number.isFinite(v))throw new Error('expected finite number');return v};
export function evaluateExpression(node,scope={}){
  if(node==null||typeof node!=='object')throw new Error('invalid expression');if('value'in node)return node.value;if('var'in node){if(!(node.var in scope))throw new Error(`missing variable: ${node.var}`);return scope[node.var]}
  const args=(node.args??[]).map(x=>evaluateExpression(x,scope));switch(node.op){case'add':return args.reduce((a,b)=>numeric(a)+numeric(b),0);case'subtract':return numeric(args[0])-numeric(args[1]);case'multiply':return args.reduce((a,b)=>numeric(a)*numeric(b),1);case'divide':if(numeric(args[1])===0)throw new Error('division by zero');return numeric(args[0])/numeric(args[1]);case'%':if(numeric(args[1])===0)throw new Error('division by zero');return numeric(args[0])%numeric(args[1]);case'mod':{const m=numeric(args[1]);if(m<=0)throw new Error('modulus must be positive');return((numeric(args[0])%m)+m)%m}case'==':return args[0]===args[1];case'<':return args[0]<args[1];case'>':return args[0]>args[1];case'and':return args.every(Boolean);case'or':return args.some(Boolean);case'not':return!args[0];case'if':return args[0]?args[1]:args[2];case'lookup':{const table=args[0];if(table==null||typeof table!=='object')throw new Error('lookup requires object');return table[args[1]]}default:throw new Error(`illegal operation: ${node.op}`)}}

export function expressionDependencies(node,result=new Set()){if(node&&typeof node==='object'){if('var'in node)result.add(node.var);for(const a of node.args??[])expressionDependencies(a,result)}return result}
export function evaluateRules(rules,initialScope={}){
  const pending=new Map(rules.map(r=>[r.target,r])),scope={...initialScope},results={},errors={};let progressed=true;
  while(pending.size&&progressed){progressed=false;for(const[target,rule]of[...pending]){const deps=expressionDependencies(rule.expression),unresolved=[...deps].filter(x=>pending.has(x));if(unresolved.length)continue;try{results[target]=scope[target]=evaluateExpression(rule.expression,scope)}catch(e){errors[target]=e.message}pending.delete(target);progressed=true}}
  if(pending.size)for(const target of pending.keys())errors[target]='cyclic dependency';return{scope,results,errors};
}
export function runInstance(instance,template){
  const initial={...instance.parameters,...instance.runtimeState.variables},executable=(template.rules??[]).filter(rule=>rule.target&&rule.expression),out=evaluateRules(executable,initial);
  for(const rule of template.rules??[]){if(rule.type==='transitive-reduction')out.results.transitiveReduction=transitiveReduction(template.slots.map(slot=>slot.id),template.edges).map(edge=>edge.id)}
  instance.runtimeState={...instance.runtimeState,...out};instance.updatedAt=new Date().toISOString();return out;
}

function transitiveReduction(nodeIds,edges){
  return edges.filter((edge,index)=>{
    const others=edges.filter((_,candidate)=>candidate!==index),seen=new Set([edge.sourceSlotId]),queue=[edge.sourceSlotId];
    while(queue.length){const current=queue.shift();for(const candidate of others.filter(item=>item.sourceSlotId===current)){if(candidate.targetSlotId===edge.targetSlotId)return false;if(!seen.has(candidate.targetSlotId)){seen.add(candidate.targetSlotId);queue.push(candidate.targetSlotId)}}}
    return true;
  });
}
