const has=(counts,...roles)=>roles.some(role=>(counts?.[role]??0)>0);
const check=(id,label,passed,details='')=>({id,label,passed:Boolean(passed),details});

export function validateCognitiveCompilation({cognitivePlan={},activation={},roleInference={},topology={}}={}){
  const taskId=cognitivePlan.taskSchema?.id,counts=roleInference.counts??{},features=topology.features??{},checks=[];
  checks.push(check('knowledge-activated','Knowledge activated',(activation.activeKnowledgeIds??[]).length>0,'认知任务至少需要一个相关 Knowledge。'));
  if(taskId==='proof-learning')checks.push(
    check('goal-identified','Goal identified',has(counts,'goal','conclusion'),'需要目标命题或结论角色。'),
    check('premises-identified','Premises identified',has(counts,'premise','definition','known-theorem','lemma'),'需要前提、定义、已知定理或引理。'),
    check('dependency-chain','Dependency chain is semantic',(features.proofEdgeCount??0)>=2,'至少需要两条真实 proves / implies / dependency 关系形成证明链。'),
    check('dependency-acyclic','Dependency chain is non-circular',!features.cyclic,'循环链不能作为完成的证明。'),
    check('conclusion-reachable','Conclusion is reachable',(features.proofEdgeCount??0)>=2&&has(counts,'goal','conclusion')&&has(counts,'proof','proof-method','bridge'),'结论必须由真实语义链和中间证明依据支持。'),
    check('unsupported-jump','No unsupported jump',!(topology.gaps??[]).some(gap=>gap.id==='missing-bridge'),'缺少桥梁时必须明确报告，而不是伪造边。')
  );
  else if(taskId==='concept-understanding')checks.push(
    check('target-identified','Target concept identified',has(counts,'target-concept','concept'),'需要当前目标概念。'),
    check('definition','Definition available',has(counts,'definition'),'需要可核查的定义。'),
    check('meaningful-relation','Meaningful relation available',(features.edgeCount??0)>0,'定义之外还需要真实关系。'),
    check('example-or-application','Example or application available',has(counts,'example','application'),'至少需要一个示例或应用。'),
    check('boundary','Boundary recognized',has(counts,'boundary','counterexample','contrast','distinction'),'需要边界、反例或区别。')
  );
  else if(taskId==='comparison')checks.push(
    check('comparison-objects','Comparison objects identified',has(counts,'object-a')&&has(counts,'object-b'),'需要两个比较对象。'),
    check('comparison-dimension','Shared comparison dimension identified',has(counts,'comparison-dimension','similarity','difference')||(features.comparisonEdgeCount??0)>0,'需要共同维度、相似或差异。')
  );
  else checks.push(check('traceable-relations','Result is traceable',(features.edgeCount??0)>0||(activation.activeKnowledgeIds??[]).length===1,'多个知识对象之间需要可追踪关系。'));
  const relevant=checks.filter(item=>item.id!=='knowledge-activated'),passed=relevant.filter(item=>item.passed).length,evidence=(activation.activeKnowledgeIds??[]).length>0;
  const status=!evidence||(!passed&&relevant.length)?'insufficient-evidence':passed===relevant.length?'complete':'partial';
  return{status,complete:status==='complete',checks,successCriteria:cognitivePlan.successCriteria??[],failureModes:cognitivePlan.failureModes??[],observedFailureModes:(topology.gaps??[]).map(gap=>gap.label),gaps:topology.gaps??[],transferTests:cognitivePlan.transferTests??[],transferSuggestions:(cognitivePlan.transferTests??[]).map(criterion=>({criterion,status:'suggested'}))};
}
