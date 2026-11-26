import {inlineMathHtml} from './math-markup.js';
import {chapterStages,chapterUnits,pathUnits,pathUnit,resolveUnit,powerErrors} from '../learning/math-path.js';
import {mathCourseById,mathKnowledgeById,mathProblemById,mathMethodById} from '../learning/math-content.js';
import {mathDiscoveryById} from '../learning/math-discovery.js';

const stages={discovery:'观察样本',knowledge:'读概念',method:'学方法',problem:'独立练习',applied:'应用检验'};
const trailKey='lmn:math-analysis:reading-trail';
const sectionId='course-analysis-2';
const button=(action,text,id='')=>`<button type="button" data-path-action="${action}" data-path-id="${id}">${inlineMathHtml(text)}</button>`;
const order=unit=>String(chapterUnits.indexOf(unit)+1).padStart(2,'0');
const stageId=(unit,stage)=>stage==='discovery'?unit.discovery:unit[stage]?.id||'';
const groupOf=unit=>chapterStages.find(group=>group.units.includes(unit.knowledge.id.slice(-3)));
function validVisit(v){
  if(!v||!Object.hasOwn(stages,v.stage)||!pathUnit(v.unit))return false;
  if(v.stage==='applied')return v.id==='';
  return Boolean(({discovery:mathDiscoveryById,knowledge:mathKnowledgeById,method:mathMethodById,problem:mathProblemById})[v.stage]?.(v.id));
}

export function groupedConcepts(items,card){
  const shown=new Set(items.map(item=>item.id));
  return chapterStages.map((group,i)=>{
    const units=group.units.map(short=>pathUnit('ANA-UC-'+short)).filter(unit=>shown.has(unit.knowledge.id));
    return units.length?`<section class="chapter-stage"><header><span>第 ${i+1} 节</span><div><h3>${group.title}</h3><p>${inlineMathHtml(group.question)}</p></div></header><div class="chapter-units">${units.map(unit=>card(unit.knowledge,order(unit))).join('')}</div></section>`:'';
  }).join('');
}

export class MathPath{
  constructor(controller){
    this.controller=controller;
    try{const saved=JSON.parse(localStorage.getItem(trailKey)||'[]');this.trail=Array.isArray(saved)?saved.filter(validVisit).slice(0,20):[]}catch{this.trail=[]}
    this.unit=pathUnit(this.trail[0]?.unit)||chapterUnits[0];
  }
  bind(){
    document.querySelector('#workspace').addEventListener('click',event=>{
      const target=event.target.closest('[data-path-action]');
      if(!target)return;
      const action=target.dataset.pathAction,id=target.dataset.pathId;
      if(action==='continue'){
        const visit=this.trail[0];
        if(visit)this.unit=pathUnit(visit.unit);
        return this.go(visit?.stage||'knowledge',visit?.id||'ALG-K01');
      }
      if(action==='course')return this.controller.openMathArchive('course',id||sectionId);
      if(action==='records')return this.controller.openMathHome('studySessionsHomeTitle');
      if(action==='lab')return this.controller.openAppliedHome();
      if(action==='research')return this.controller.toggleNavigator();
      this.go(action,id);
    });
    const form=document.querySelector('#pathLookup');
    form.onsubmit=event=>{
      event.preventDefault();
      this.controller.mathArchive.search.knowledge=form.elements.query.value.trim();
      this.controller.mathArchive.catalogFilters.knowledge={};
      this.controller.openMathArchive('knowledge');
    };
  }
  go(action,id){
    if(action==='applied')return this.controller.openAppliedHome(this.unit.knowledge.id);
    if(Object.hasOwn(stages,action))this.controller.openMathArchive(action,id||stageId(this.unit,action));
  }
  record(stage,id,unit){
    if(!unit)return;
    this.unit=unit;
    const visit={stage,id,unit:unit.knowledge.id};
    if(!validVisit(visit))return;
    if(this.trail[0]?.stage===stage&&this.trail[0].id===id&&this.trail[0].unit===visit.unit)return;
    this.trail=[visit,...this.trail.filter(v=>v.unit!==visit.unit||v.stage!==stage||v.id!==id)].slice(0,20);
    try{localStorage.setItem(trailKey,JSON.stringify(this.trail))}catch{}
  }
  forPage(stage,id){
    let unit=resolveUnit(stage,id,this.unit.knowledge.id);
    if(!unit&&stage==='discovery'){
      const sample=mathDiscoveryById(id);
      unit=sample?.knowledgeIds?.map(pathUnit).find(Boolean);
    }
    if(!unit)return '';
    this.record(stage,id,unit);
    return this.route(stage);
  }
  route(stage){
    const unit=this.unit;
    const course=mathCourseById(unit.knowledge.courseId);
    const linkedStages=Object.entries(stages).filter(([key])=>key==='applied'?!course.semester:stageId(unit,key));
    const steps=linkedStages.map(([key,label])=>key===stage?`<span aria-current="step">${label}</span>`:button(key,label,stageId(unit,key))).join('');
    const units=pathUnits.filter(candidate=>candidate.knowledge.courseId===course.id);
    const next=units[units.indexOf(unit)+1];
    const location=course.semester?(course.chapters.find(chapter=>chapter.id===unit.knowledge.chapterId)?.title||course.title):groupOf(unit).title+' / '+order(unit);
    return `<nav class="concept-route" aria-label="当前概念的学习路径"><div class="route-heading">${button('course',course.title,course.id)}<span>${inlineMathHtml(location)} · ${inlineMathHtml(unit.knowledge.title)}</span></div><p>${inlineMathHtml(unit.question)}</p><div class="route-steps">${steps}${button('records','我的学习与复习')}</div><div class="route-next">${next?button('knowledge','下一单元 · '+next.knowledge.title,next.knowledge.id):button('course','回看全章目录',course.id)}</div></nav>`;
  }
  home(){
    const visit=this.trail[0];
    document.querySelector('#pathContinue').innerHTML=inlineMathHtml(visit?'继续上次 · '+stages[visit.stage]+' · '+this.unit.knowledge.title:'从近世代数开始 · 群与单位元');
    const root=document.querySelector('#pathRecent');
    root.replaceChildren();
    for(const v of this.trail.slice(0,5)){
      const link=document.createElement('button');link.type='button';
      link.innerHTML=inlineMathHtml(stages[v.stage]+' · '+pathUnit(v.unit).knowledge.title);
      link.onclick=()=>{this.unit=pathUnit(v.unit);this.go(v.stage,v.id)};
      root.append(link);
    }
    if(!root.childElementCount)root.textContent='打开章节里的概念或样本后，可以从这里接着学。';
  }
  application(id){
    this.unit=pathUnit(id)||chapterUnits.at(-1);
    this.record('applied','',this.unit);
    const root=document.querySelector('#pathApplication');
    root.innerHTML=this.route('applied')+`<section class="math-surface power-lab"><h2>误差实验 · 近似积分需要多准？</h2><p>用 ${inlineMathHtml('$x^n$')} 在 ${inlineMathHtml('$[0,b]$')} 上的积分近似其逐点极限的积分。先把允许误差定为 0.05，预测哪一种误差会先达标。</p><div class="lab-controls"><label>${inlineMathHtml('项数 $n$')} <input type="range" min="1" max="64" value="8" name="terms"><output data-lab-n></output></label><label>${inlineMathHtml('右端点 $b$')} <select name="endpoint"><option value="1">1</option><option value="0.95">0.95</option><option value="0.8">0.8</option><option value="0.5">0.5</option></select></label></div><dl class="lab-results" aria-live="polite"><div><dt>区间误差上确界 · ${inlineMathHtml('$b^n$')}</dt><dd data-lab-uniform></dd></div><div><dt>积分误差 · ${inlineMathHtml('$b^{n+1}/(n+1)$')}</dt><dd data-lab-integral></dd></div></dl><p>当 ${inlineMathHtml('$b=1$')} 时，极限在端点等于 1，在其余各点为 0。误差在端点为 0，却能从左侧任意接近 1。</p><label class="lab-note">${inlineMathHtml('改变 $b$ 后')}，哪一种误差仍能控制积分？把你的解释记入本单元。<textarea rows="2" maxlength="5000"></textarea></label><p class="lab-save" role="status"></p>${button('knowledge','带着实验结论回看 · '+this.unit.knowledge.title,this.unit.knowledge.id)}</section>`;
    const archive=this.controller.mathArchive,subject=this.unit.knowledge.id;
    const saved=archive.annotations.get('math-note:'+subject);
    const n=root.querySelector('[name=terms]'),b=root.querySelector('[name=endpoint]'),note=root.querySelector('textarea');
    n.value=saved?.applicationN||8;b.value=saved?.applicationB||1;note.value=saved?.applicationNote||'';
    const update=()=>{
      const errors=powerErrors(Number(n.value),Number(b.value));
      root.querySelector('[data-lab-n]').value=n.value;
      for(const [key,value] of Object.entries(errors))root.querySelector('[data-lab-'+key+']').textContent=Number(value.toPrecision(4))+(value<=0.05?' · 达标':' · 超出预算');
    };
    const save=()=>archive.updateAnnotation(subject,{applicationN:Number(n.value),applicationB:Number(b.value),applicationNote:note.value},{immediate:true});
    n.oninput=update;b.oninput=update;n.onchange=save;b.onchange=save;note.onchange=save;
    note.oninput=()=>{archive.updateAnnotation(subject,{applicationNote:note.value});root.querySelector('.lab-save').textContent='实验笔记会随本单元保存在此浏览器。'};
    update();
  }
}

