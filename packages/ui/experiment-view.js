import { bernoulliLaw,cyclicOrbit,logisticSlope,logisticValue } from '../learning/math-experiments.js';
import { renderStudyMarkdown } from './math-markup.js';

const details = {
  'LAB-CYCLIC':{
    intro:'在 $\\mathbb Z/n\\mathbb Z$ 中，从 $0$ 开始反复加 $g$。改变 $g$，比较最早回到 $0$ 的步数和陪集个数。',
    proof:'令 $d=\\gcd(n,g)$。写成 $n=dn_1,g=dg_1$ 后，$n\\mid kg$ 当且仅当 $n_1\\mid k$。因此 $g$ 的阶为 $n/d$，陪集数为 $d$。',
    controls:[['n','模数',2,32,1,8],['g','每步所加的元素',0,7,1,2]]
  },
  'LAB-BERNOULLI':{
    intro:'独立重复试验，单次成功概率为 $p$。比较成功次数的分布，以及已知至少成功一次时第一次成功的概率。',
    proof:'事件 $A$「第一次成功」包含于 $B$「至少成功一次」。当 $P(B)>0$，$P(A\\mid B)=p/[1-(1-p)^n]$；当 $p=0$，条件事件概率为零。',
    controls:[['n','试验次数',1,16,1,2],['p','单次成功概率',0,1,0.05,0.5]]
  },
  'LAB-LOGISTIC':{
    intro:'调整 $y(0)=y_0$ 和增长率 $r$，观察 $y\'=r y(1-y)$ 的方向场与初值解。',
    proof:'$y=0$ 与 $y=1$ 都是平衡解。对 $r>0$、$y_0>0$，$y(t)$ 趋向 $1$；$y=0$ 的任意小正扰动最终离开 $0$ 的邻域。分离变量前需保留两个常值解。',
    controls:[['y','初值',0,1.6,0.05,0.2],['r','增长率',0.1,3,0.1,1]]
  }
};

function graphLogistic(y,r) {
  const sx=t=>35+t*55, sy=v=>184-v*96;
  const directions=[];
  for(let t=0;t<=8;t+=0.5) for(let v=0;v<=1.6;v+=0.2){
    const slope=(96/55)*logisticSlope(v,r),dx=7/Math.hypot(1,slope),dy=-dx*slope;
    directions.push(`M ${sx(t)-dx} ${sy(v)-dy} l ${2*dx} ${2*dy}`);
  }
  const curve=Array.from({length:121},(_,i)=>{
    const t=i/15;
    return (i?'L':'M')+sx(t)+' '+sy(logisticValue(t,y,r));
  }).join(' ');
  return `<svg viewBox="0 0 500 210" role="img" aria-label="Logistic 方向场、初值解与 y 等于 1 的平衡线">
    <path d="M35 16v168h452 M35 88h440" fill="none" stroke="var(--line-strong)"/>
    <text x="9" y="19" fill="var(--muted)">y</text><text x="482" y="202" fill="var(--muted)">t</text>
    <text x="16" y="93" fill="var(--muted)">1</text><text x="17" y="188" fill="var(--muted)">0</text>
    <path d="${directions.join(' ')}" fill="none" stroke="var(--muted)" opacity=".55"/>
    <path d="${curve}" fill="none" stroke="var(--green)" stroke-width="3"/>
    </svg>`;
}

export function mountExperiment(root, experiment, {note='', save, open}={}) {
  const config=details[experiment.id];
  if(!config)return;
  const controlMarkup=config.controls.map(([key,label,min,max,step,value])=>
    `<label>${label} <output></output><input name="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`
  ).join('');
  root.classList.add('course-experiment');
  root.innerHTML=`<h3></h3><div class="experiment-intro"></div><div class="experiment-inputs">${controlMarkup}</div>
    <div class="experiment-results" role="region" aria-label="计算结果"></div>
    <details><summary>解释与证明</summary><div class="experiment-proof"></div></details>
    <label class="experiment-note">我的猜想<textarea rows="3" maxlength="12000"></textarea></label>
    <div class="course-page-turn"><button type="button" data-lab-ref="knowledge">相关知识</button><button type="button" data-lab-ref="problem">相关练习</button></div>`;
  root.querySelector('h3').textContent=experiment.title;
  renderStudyMarkdown(root.querySelector('.experiment-intro'),config.intro);
  renderStudyMarkdown(root.querySelector('.experiment-proof'),config.proof);
  const field=root.querySelector('textarea');field.value=note;
  field.addEventListener('input',()=>save?.(field.value));
  for(const button of root.querySelectorAll('[data-lab-ref]')){
    const kind=button.dataset.labRef;
    button.onclick=()=>open?.(kind,kind==='problem'?experiment.problemId:experiment.knowledgeId);
  }
  const values=()=>Object.fromEntries([...root.querySelectorAll('input')].map(input=>[input.name,input.valueAsNumber]));
  const draw=()=>{
    let v=values();
    if(experiment.id==='LAB-CYCLIC'){
      root.querySelector('[name=g]').max=v.n-1;
      v=values();
    }
    for(const control of root.querySelectorAll('input'))control.previousElementSibling.value=control.value;
    const result=root.querySelector('.experiment-results');
    if(experiment.id==='LAB-CYCLIC'){
      const orbit=cyclicOrbit(v.n,v.g);
      result.innerHTML=`<p>阶 <strong>${orbit.order}</strong> · 陪集数 <strong>${orbit.index}</strong></p>
       <ol class="experiment-orbit" aria-label="生成的循环">${orbit.orbit.map(value=>'<li>'+value+'</li>').join('')}</ol>
       <details><summary>查看陪集</summary><ul>${orbit.cosets.map(set=>'<li>{'+set.join(', ')+'}</li>').join('')}</ul></details>`;
    }else if(experiment.id==='LAB-BERNOULLI'){
      const law=bernoulliLaw(v.n,v.p),peak=Math.max(...law.distribution);
      result.innerHTML=`<p>至少成功一次 <strong>${law.positive.toFixed(4)}</strong> · 条件概率 <strong>${law.conditional?.toFixed(4)??'未定义'}</strong></p>
       <div class="experiment-bars" role="img" aria-label="成功次数的概率分布">
         ${law.distribution.map((mass,k)=>`<span title="成功 ${k} 次，概率 ${mass.toFixed(5)}"><i style="height:${mass/peak*100}%"></i><b>${k}</b></span>`).join('')}
       </div>`;
    }else result.innerHTML=graphLogistic(v.y,v.r);
  };
  for(const input of root.querySelectorAll('input'))input.addEventListener('input',draw);
  draw();
}

