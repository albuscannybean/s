import {semesterKnowledge,semesterMethods,semesterProblems} from './semester-content.js';
import {mathKnowledgeById, mathProblemById, mathMethodById} from './math-content.js';

export const chapterStages = [
  {title:'从逐点观察到统一定义', question:'选择项数 N 时，能否让它与观察点无关？', units:['K01','K02','K03']},
  {title:'估计整个区间的误差', question:'知道极限时怎样估计？未知极限时又怎样判定？', units:['K04','K09','K05']},
  {title:'用反例辨认条件的边界', question:'最坏的点在哪里？缩小定义域会发生什么？', units:['K08','K10']},
  {title:'把误差控制用于极限运算', question:'哪些条件允许把极限带进连续性论证或积分？', units:['K06','K07']}
];

// Each row pairs a reading with one experiment, one technique and one independent attempt.
const connections = {
  K01:['POWER','M01','P01','固定 x，再增加 n。若改选靠近端点的 x，原来的 N 还够吗？'],
  K02:['LINEAR','M04','P05','先给定允许的误差，再为整个区间选出一个 N。'],
  K03:['POWER','M01','P02','要否定一致收敛，哪些量必须固定，哪些可以随 n 改变？'],
  K04:['POWER','M02','P12','最大值取不到时，怎样给整段区间的误差定界？'],
  K09:['SINE','M04','P09','振荡越来越快，为什么仍能用同一个上界控制误差？'],
  K05:['LINEAR','M05','P15','遮住极限函数，只比较足够靠后的两项，怎样控制它们的距离？'],
  K08:['SPIKE','M03','P07','试着让观察点随 n 移动，能否始终追到同样高的峰？'],
  K10:['POWER','M04','P03','把右端点从 1 移到 0.8，统一估计改变在哪里？'],
  K06:['RECIPROCAL','M04','P11','每一项都连续，极限却可能不连续。证明的哪一步需要统一的 N？'],
  K07:['INTEGRAL','M04','P17','峰变窄能否抵消高度的增长？用误差估计解释积分何时可以交换。']
};

export const chapterUnits = chapterStages.flatMap(group=>group.units).map(short=>{
  const [sample,method,problem,question]=connections[short];
  return {knowledge:mathKnowledgeById('ANA-UC-'+short), discovery:'SEQ-'+sample,
    method:mathMethodById('ANA-UC-'+method), problem:mathProblemById('ANA-UC-'+problem), question};
});
const semesterUnits=semesterKnowledge.map(knowledge=>({
  knowledge, method:semesterMethods.find(item=>item.knowledgeIds.includes(knowledge.id)),
  problem:semesterProblems.find(item=>item.knowledgeIds.includes(knowledge.id)),
  question:knowledge.summary
}));
export const pathUnits=[...chapterUnits,...semesterUnits];
export const pathUnit = id=>pathUnits.find(u=>u.knowledge.id===id);
export function resolveUnit(view,id,previous){
  if(view==='knowledge')return pathUnit(id);
  const matches=u=>view==='discovery'?u.discovery===id:view==='problem'?mathProblemById(id)?.knowledgeIds.includes(u.knowledge.id):view==='method'?mathMethodById(id)?.knowledgeIds.includes(u.knowledge.id):false;
  const prior=pathUnit(previous);
  if(prior&&(prior[view]?.id===id||matches(prior)))return prior;
  if(view==='method')return pathUnits.find(matches);
  return pathUnits.find(u=>u[view]?.id===id)||pathUnits.find(matches);
}

export function powerErrors(n,b){
  // At b=1 the pointwise limit jumps at the endpoint. The supremum is approached from the left.
  return {uniform:b**n, integral:b**(n+1)/(n+1)};
}

