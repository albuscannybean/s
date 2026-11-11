import {mathKnowledgeById,mathProblemById} from './math-content.js';

export const MATH_DISCOVERY_VERSION='math-discovery/1';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

const cases=[
  {
    id:'SEQ-POWER',title:'幂函数列：xⁿ',group:'边界与定义域',expression:'fₙ(x) = xⁿ',latex:'f_n(x)=x^n',
    description:'每个固定的 x<1 都会让 xⁿ 趋于 0；但当 x 越来越接近 1 时，图像的变化会怎样？',
    limitDescription:'在 [0,1] 上，x<1 时极限为 0，x=1 时极限为 1；在 [0,a]（a<1）上则处处趋于 0。',
    observationPrompt:'固定一个 x，再让 n 增大；随后让 x 随 n 向 1 移动。两种观察会给出相同的印象吗？',
    movingPointLabel:'靠近右端点的点 xₙ = 1 − 1/n',
    pointwiseHint:'固定 x<1 时，xⁿ→0；但 x=1 始终等于 1。',
    yDomain:[0,1],tags:['函数列','边界','定义域'],
    knowledgeIds:['ANA-UC-K01','ANA-UC-K02','ANA-UC-K03','ANA-UC-K04','ANA-UC-K10'],
    problemIds:['ANA-UC-P02','ANA-UC-P03','ANA-UC-P04','ANA-UC-P12','ANA-UC-P20'],
    evaluate:(x,n)=>Math.pow(x,n),
    limitAt:x=>x>=1-1e-10?1:0,
    movingPoint:(n,lo,hi)=>clamp(hi-1/n,lo,hi),
    supValue:(n,lo,hi)=>hi>=1-1e-10&&lo<1-1e-10?1:Math.pow(hi,n),
    supKind:'exact',
    uniformOnDomain:(lo,hi)=>hi<1-1e-10
  },
  {
    id:'SEQ-LINEAR',title:'线性缩放：x/n',group:'统一控制',expression:'fₙ(x) = x/n',latex:'f_n(x)=x/n',
    description:'图像保持同一种形状，只是整体变矮。观察最大高度如何随 n 变化。',
    limitDescription:'对每个固定 x，fₙ(x)→0；在任意固定有界区间上，误差都能被区间端点与 n 共同控制。',
    observationPrompt:'定义域扩大时，统一误差上界怎样变化？如果定义域变成整个实数轴，结论还成立吗？',
    movingPointLabel:'取当前区间右端点 xₙ = b',
    pointwiseHint:'|x/n|≤b/n，其中 b 是当前区间右端点。',
    yDomain:[0,1],tags:['统一估计','有界区间','反例边界'],
    knowledgeIds:['ANA-UC-K02','ANA-UC-K04','ANA-UC-K09','ANA-UC-K10'],
    problemIds:['ANA-UC-P06','ANA-UC-P15'],
    evaluate:(x,n)=>x/n,
    limitAt:()=>0,
    movingPoint:(n,lo,hi)=>hi,
    supValue:(n,lo,hi)=>hi/n,
    supKind:'exact',
    uniformOnDomain:()=>true
  },
  {
    id:'SEQ-SINE',title:'振荡与衰减：sin(nx)/n',group:'统一控制',expression:'fₙ(x) = sin(nx)/n',latex:'f_n(x)=\\sin(nx)/n',
    description:'频率随 n 增大，振荡越来越密；与此同时，振幅也在缩小。哪一种变化决定了整体误差？',
    limitDescription:'对每个固定 x，fₙ(x)→0；因为 |sin(nx)/n|≤1/n，所以在整个实数轴上也一致趋于 0。',
    observationPrompt:'把“振荡越来越快”和“函数整体越来越接近 0”区分开。频率增加是否必然意味着误差变大？',
    movingPointLabel:'取 xₙ = π/(2n)，使正弦项达到 1（若该点在当前区间内）',
    pointwiseHint:'振荡频率增加，但振幅被 1/n 统一压低。',
    yDomain:[-1,1],tags:['振荡','统一上界','三角函数'],
    knowledgeIds:['ANA-UC-K02','ANA-UC-K04','ANA-UC-K09'],
    problemIds:['ANA-UC-P09','ANA-UC-P19'],
    evaluate:(x,n)=>Math.sin(n*x)/n,
    limitAt:()=>0,
    movingPoint:(n,lo,hi)=>clamp(Math.PI/(2*n),lo,hi),
    supValue:(n)=>1/n,
    supKind:'bound',
    uniformOnDomain:()=>true
  },
  {
    id:'SEQ-SPIKE',title:'移动尖峰：峰宽与位置',group:'移动的反例',expression:'fₙ(x) = max(1 − 2n|x − 1/n|, 0)',latex:'f_n(x)=(1-2n|x-1/n|)_+',
    description:'尖峰越来越窄，并逐渐向左移动。固定位置观察时，它最终会消失；但整条曲线的最高点呢？',
    limitDescription:'在 [0,1] 上，每个固定 x 的函数值最终都为 0；尖峰位置 xₙ=1/n 却始终保持高度 1。',
    observationPrompt:'分别追踪一个固定的 x 和移动的峰顶 xₙ=1/n。为什么“每个固定点最终消失”与“最大值始终为 1”可以同时成立？',
    movingPointLabel:'峰顶 xₙ = 1/n',
    pointwiseHint:'尖峰的支撑区间随 n 缩小并向 0 移动；固定 x>0 最终离开支撑区间。',
    yDomain:[0,1],tags:['移动峰值','反例','逐点收敛'],
    knowledgeIds:['ANA-UC-K03','ANA-UC-K04','ANA-UC-K08'],
    problemIds:['ANA-UC-P07','ANA-UC-P16'],
    evaluate:(x,n)=>Math.max(1-2*n*Math.abs(x-1/n),0),
    limitAt:()=>0,
    movingPoint:(n,lo,hi)=>clamp(1/n,lo,hi),
    supValue:(n,lo,hi)=>Math.max(1-2*n*Math.abs(clamp(1/n,lo,hi)-1/n),0),
    supKind:'exact',
    uniformOnDomain:(lo)=>lo>0
  },
  {
    id:'SEQ-PEAK',title:'移动峰：nxe⁻ⁿˣ',group:'移动的反例',expression:'fₙ(x) = nx e⁻ⁿˣ',latex:'f_n(x)=nx e^{-nx}',
    description:'峰值的位置向 0 移动，但峰值高度并没有随 n 消失。观察位置与高度的分离。',
    limitDescription:'对每个固定 x≥0，fₙ(x)→0；但峰值位于 xₙ=1/n，高度始终为 1/e。',
    observationPrompt:'峰的位置和峰的高度分别怎样变化？如果只在几个固定 x 上取值，会漏掉什么信息？',
    movingPointLabel:'峰顶 xₙ = 1/n，函数值恒为 1/e',
    pointwiseHint:'令 t=nx。峰顶对应 t=1，因此 x=1/n，而函数值为 e⁻¹。',
    yDomain:[0,0.4],tags:['极值','移动点','反例'],
    knowledgeIds:['ANA-UC-K03','ANA-UC-K04','ANA-UC-K08'],
    problemIds:['ANA-UC-P07','ANA-UC-P16'],
    evaluate:(x,n)=>n*x*Math.exp(-n*x),
    limitAt:()=>0,
    movingPoint:(n,lo,hi)=>clamp(1/n,lo,hi),
    supValue:(n,lo,hi)=>{const x=clamp(1/n,lo,hi);return n*x*Math.exp(-n*x)},
    supKind:'exact',
    uniformOnDomain:(lo)=>lo>0
  },
  {
    id:'SEQ-RATIONAL',title:'有理函数列：x/(1+nx)',group:'统一控制',expression:'fₙ(x) = x/(1 + nx)',latex:'f_n(x)=\\frac{x}{1+nx}',
    description:'分母中的 n 对整个定义域产生统一影响。与移动尖峰对照，观察它为什么没有留下固定高度的峰。',
    limitDescription:'对每个固定 x≥0，fₙ(x)→0；在 [0,b] 上有 0≤fₙ(x)≤b/(1+nb)→0。',
    observationPrompt:'比较它与移动尖峰：两者都含有 n，但为什么一个的全域最大误差趋于 0，另一个却没有？',
    movingPointLabel:'取当前区间右端点 xₙ = b',
    pointwiseHint:'函数关于 x 单调递增，最大值出现在区间右端点。',
    yDomain:[0,1],tags:['有理函数','单调性','统一估计'],
    knowledgeIds:['ANA-UC-K02','ANA-UC-K04','ANA-UC-K09'],
    problemIds:['ANA-UC-P08','ANA-UC-P20'],
    evaluate:(x,n)=>x/(1+n*x),
    limitAt:()=>0,
    movingPoint:(n,lo,hi)=>hi,
    supValue:(n,lo,hi)=>hi/(1+n*hi),
    supKind:'exact',
    uniformOnDomain:()=>true
  },
  {
    id:'SEQ-RECIPROCAL',title:'端点现象：1/(1+nx)',group:'边界与定义域',expression:'fₙ(x) = 1/(1 + nx)',latex:'f_n(x)=\\frac{1}{1+nx}',
    description:'所有正数位置的函数值都会趋于 0，但 x=0 始终等于 1。再把定义域左端点移开，结论会怎样？',
    limitDescription:'在 [0,1] 上，x=0 的极限为 1，而每个固定 x>0 的极限为 0；在 [δ,1]（δ>0）上则一致趋于 0。',
    observationPrompt:'单独检查 x=0，再检查任意固定 x>0。把定义域限制为 [δ,1] 后，造成不统一的端点还在吗？',
    movingPointLabel:'取 xₙ = 1/n，此时 fₙ(xₙ)=1/2',
    pointwiseHint:'x=0 是特殊点；在远离 0 的区间上，分母有统一下界 1+nδ。',
    yDomain:[0,1],tags:['端点','不连续极限','定义域变化'],
    knowledgeIds:['ANA-UC-K02','ANA-UC-K03','ANA-UC-K06','ANA-UC-K10'],
    problemIds:['ANA-UC-P13','ANA-UC-P14'],
    evaluate:(x,n)=>1/(1+n*x),
    limitAt:x=>x<=1e-10?1:0,
    movingPoint:(n,lo,hi)=>clamp(1/n,lo,hi),
    supValue:(n,lo)=>lo<=1e-10?1:1/(1+n*lo),
    supKind:'exact',
    uniformOnDomain:(lo)=>lo>0
  }
];

export const MATH_DISCOVERY_CASES=Object.freeze(cases.map(item=>Object.freeze(item)));
export const mathDiscoveryById=id=>MATH_DISCOVERY_CASES.find(item=>item.id===id)??null;
export const mathDiscoveryDomain=value=>{
  const [lo,hi]=String(value??'0:1').split(':').map(Number);
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<0||hi>1||lo>=hi)return{lo:0,hi:1};
  return{lo,hi};
};
export function validateMathDiscoveryContent(){
  const ids=new Set(),errors=[];
  for(const item of MATH_DISCOVERY_CASES){
    if(ids.has(item.id))errors.push('duplicate discovery id: '+item.id);
    ids.add(item.id);
    for(const field of ['title','group','expression','latex','description','limitDescription','observationPrompt','movingPointLabel','pointwiseHint'])if(!item[field])errors.push(item.id+' missing '+field);
    if(typeof item.evaluate!=='function'||typeof item.limitAt!=='function'||typeof item.supValue!=='function'||typeof item.uniformOnDomain!=='function')errors.push(item.id+' missing evaluator');
    for(const id of item.knowledgeIds)if(!mathKnowledgeById(id))errors.push(item.id+' references missing knowledge '+id);
    for(const id of item.problemIds)if(!mathProblemById(id))errors.push(item.id+' references missing problem '+id);
    for(const n of [1,2,4,8,16])if(!Number.isFinite(item.evaluate(0.37,n)))errors.push(item.id+' returned a non-finite value');
  }
  return errors;
}
