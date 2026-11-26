import {inlineMathHtml} from './math-markup.js';
import {MATH_DISCOVERY_CASES,mathDiscoveryById,mathDiscoveryDomain} from '../learning/math-discovery.js';
import {mathKnowledgeById,mathProblemById} from '../learning/math-content.js';
import {RIGOR_SAMPLE_ID,RIGOR_TERMS,RIGOR_NOTE_FIELDS,localRigorDate} from '../learning/math-rigor.js';
import {renderRigorDaily,renderRigorReference} from './math-rigor.js';

const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>{
  if(!Number.isFinite(value))return '—';
  if(value!==0&&Math.abs(value)<0.001)return value.toExponential(2);
  return Number(value).toFixed(3).replace(/\.?0+$/,'')||'0';
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const linkCard=(kind,id,title,detail)=>{
  return '<button type="button" class="math-item-card" data-archive-kind="'+h(kind)+'" data-id="'+h(id)+'"><span class="math-item-title">'+inlineMathHtml(title)+'</span><small>'+inlineMathHtml(detail||id)+'</small><span class="math-item-arrow" aria-hidden="true">↗</span></button>';
};

export function renderDiscoveryPage({selectedId='',compareId='',annotations=new Map(),rigorDate=localRigorDate()}={}){
  const selected=mathDiscoveryById(selectedId)||MATH_DISCOVERY_CASES[0];
  const compare=mathDiscoveryById(compareId)&&compareId!==selected.id?mathDiscoveryById(compareId):MATH_DISCOVERY_CASES.find(item=>item.id!==selected.id);
  const note=annotations.get('math-note:'+selected.id)||{};
  const rigor=selected.id===RIGOR_SAMPLE_ID;
  const options=MATH_DISCOVERY_CASES.filter(item=>item.id!==selected.id).map(item=>'<option value="'+h(item.id)+'" '+(item.id===compare?.id?'selected':'')+'>'+h(item.title)+'</option>').join('');
  const knowledge=selected.knowledgeIds.map(id=>{const item=mathKnowledgeById(id);return item?linkCard('knowledge',id,item.title,item.kind):''}).join('');
  const problems=selected.problemIds.map(id=>{const item=mathProblemById(id);return item?linkCard('problem',id,item.title,item.type+' · 难度 '+item.difficulty):''}).join('');
  const presets=rigor?'<div class="math-rigor-presets" role="group" aria-label="选择示例项数">'+RIGOR_TERMS.map(n=>'<button type="button" data-discovery-preset="'+n+'" aria-pressed="false">n = '+n+'</button>').join('')+'</div>':'';
  const noteFields=(rigor?Object.keys(RIGOR_NOTE_FIELDS):['observation','conjecture','counterexample']).map(field=>{
    const [label,prompt]=RIGOR_NOTE_FIELDS[field];
    return '<label>'+label+(rigor?'<small>'+prompt+'</small>':'')+'<textarea data-discovery-note="'+field+'" rows="3" maxlength="100000"'+(rigor?'':' placeholder="'+h(prompt)+'"')+'>'+h(note[field]||'')+'</textarea></label>';
  }).join('');
  return '<div class="math-discovery-page" data-discovery-selected="'+h(selected.id)+'">'+
    
    '<div class="math-discovery-layout"><div class="math-discovery-main">'+
      '<section class="math-discovery-paper"><header class="math-discovery-heading"><div><span class="math-kicker">'+h(selected.id)+' · '+h(selected.group)+'</span><h3>'+h(selected.title)+'</h3><p>'+inlineMathHtml(selected.description)+'</p></div><span class="math-discovery-mark">∿</span></header>'+
        '<div class="math-discovery-formula" id="discoveryFormula">'+inlineMathHtml('$'+selected.latex+'$')+'</div><section class="math-discovery-observation-prompt"><span>先做一个预测</span><div id="discoveryPrompt"></div></section><details class="math-discovery-hint"><summary>需要时查看一条观察线索</summary><div id="discoveryPointwiseHint"></div></details>'+
        presets+'<div class="math-discovery-controls"><label>'+inlineMathHtml('项数 $n$ ')+'<output id="discoveryNValue"></output><input id="discoveryN" type="range" min="1" max="32" step="1" value="'+h(note.discoveryN??(rigor?2:8))+'"></label><label>观察区间<select id="discoveryDomain"><option value="0:1" '+(note.discoveryDomain==='0:1'?'selected':'')+'>[0, 1]</option><option value="0:0.8" '+(note.discoveryDomain==='0:0.8'?'selected':'')+'>[0, 0.8]</option><option value="0.2:1" '+(note.discoveryDomain==='0.2:1'?'selected':'')+'>[0.2, 1]</option></select></label><label>固定观察点 x₀ <output id="discoveryXValue"></output><input id="discoveryX" type="range" min="0" max="100" step="1" value="'+h(note.discoveryX??50)+'"></label></div>'+
        '<div class="math-discovery-plot-wrap"><div class="math-discovery-plot-head"><strong>图像比较</strong><small>'+inlineMathHtml('横轴 $x$ · 纵轴 $f_n(x)$。点选图中位置或移动「固定观察点」，再改变 $n$。')+'</small></div><div id="discoveryPlotPrimary" class="math-discovery-plot"></div><div id="discoveryLegend" class="math-discovery-legend"></div></div>'+
        '<div id="discoveryMetrics" class="math-discovery-metrics"></div><details class="math-discovery-reveal"><summary>完成观察后，再查看已知数学结论</summary><div id="discoveryConclusion"></div></details>'+
        '<section class="math-discovery-table-wrap"><h4>固定点与移动点的数值</h4><p>'+inlineMathHtml(selected.movingPointLabel)+'</p><div id="discoveryPointTable"></div></section>'+
        (rigor?'<details class="math-discovery-reveal"><summary>推导反例与误差估计</summary><div id="rigorProof"></div></details>':'')+
      '</section>'+
      (rigor?renderRigorReference():'')+
      '<section class="math-discovery-paper"><header><div><span class="math-kicker">RELATED MATERIAL</span><h3>相关知识与问题</h3><p>从一个样本可以进入多个知识点，也可以转向不同类型的题目。</p></div></header><div class="math-discovery-related"><section><h4>相关知识</h4><div class="math-compact-grid">'+knowledge+'</div></section><section><h4>相关习题</h4><div class="math-compact-grid">'+problems+'</div></section></div></section>'+
    '</div><aside class="math-discovery-side">'+
      (rigor?renderRigorDaily(rigorDate):'')+
      '<section class="math-discovery-paper"><span class="math-kicker">COMPARISON</span><h3>再选一个样本</h3><label class="math-discovery-compare-label">对照对象<select id="discoveryCompare">'+options+'</select></label><div id="discoveryComparePlot" class="math-discovery-compare-plot"></div><div id="discoveryCompareMetrics"></div></section>'+
      '<section class="math-discovery-paper math-discovery-notes"><span class="math-kicker">PERSONAL RESEARCH NOTES</span><h3>记录正在形成的认识</h3><p>不必马上得出结论。可以先记下观察，再写猜想，也可以保留暂时无法解释的反例。</p>'+
        noteFields+
        '<div class="math-discovery-note-actions"><button type="button" class="primary" data-discovery-action="copy">复制当前探索上下文给 AI</button><small id="discoveryStatus" role="status" aria-live="polite">观察记录会自动保存在本机，并可随个人批注一起导出。</small></div>'+
      '</section>'+
    '</aside></div></div>';
}

const plotTerms=(sample,n)=>[...new Set([...(sample.integral?RIGOR_TERMS:[1,2,4,8]).filter(term=>term!==n),n])];
const seriesColors=['var(--discovery-series-a)','var(--discovery-series-b)','var(--discovery-series-c)','var(--discovery-series-d)'];
const plotColor=(term,n,index)=>term===n?'var(--discovery-series-current)':seriesColors[index];

function plotSvg(sample,n,lo,hi,x0){
  const width=720,height=278,left=48,right=16,top=16,bottom=34,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const series=plotTerms(sample,n);
  const [yMin,yMax]=sample.yDomain??[0,Math.max(1,Math.ceil(Math.max(...series.map(term=>sample.supValue(term,lo,hi)))))];
  const ySpan=yMax-yMin;
  const sx=x=>left+(x-lo)/(hi-lo)*plotWidth,sy=y=>top+(yMax-y)/ySpan*plotHeight;
  const xs=new Set(Array.from({length:181},(_,i)=>lo+(hi-lo)*i/180));
  xs.add(x0);
  for(const m of series){const moving=sample.movingPoint(m,lo,hi);if(moving>=lo&&moving<=hi)xs.add(moving)}
  const points=[...xs].sort((a,b)=>a-b);
  let grid='';
  for(let i=0;i<=4;i++){const y=top+plotHeight*i/4,value=yMax-ySpan*i/4;grid+='<line x1="'+left+'" y1="'+y+'" x2="'+(width-right)+'" y2="'+y+'" class="math-discovery-grid-line"/><text x="'+(left-9)+'" y="'+(y+4)+'" text-anchor="end" class="math-discovery-axis-label">'+h(fmt(value))+'</text>'}
  for(let i=0;i<=4;i++){const x=left+plotWidth*i/4,value=lo+(hi-lo)*i/4;grid+='<line x1="'+x+'" y1="'+top+'" x2="'+x+'" y2="'+(top+plotHeight)+'" class="math-discovery-grid-line"/><text x="'+x+'" y="'+(height-9)+'" text-anchor="middle" class="math-discovery-axis-label">'+h(fmt(value))+'</text>'}
  let paths='';
  series.forEach((m,index)=>{
    const d=points.map((x,i)=>(i?'L':'M')+sx(x).toFixed(2)+' '+sy(clamp(sample.evaluate(x,m),yMin,yMax)).toFixed(2)).join(' ');
    if(sample.integral&&m===n)paths+='<path d="'+d+' L '+sx(hi)+' '+sy(0)+' L '+sx(lo)+' '+sy(0)+' Z" fill="var(--green)" opacity="0.10"/>';
    paths+='<path d="'+d+'" fill="none" stroke="'+plotColor(m,n,index)+'" stroke-width="'+(m===n?2.7:1.6)+'" stroke-linecap="round" stroke-linejoin="round" opacity="'+(m===n?1:0.72)+'"/>';
  });
  const fixedY=clamp(sample.evaluate(x0,n),yMin,yMax),movingX=sample.movingPoint(n,lo,hi),movingY=clamp(sample.evaluate(movingX,n),yMin,yMax);
  const fixedMarker='<circle cx="'+sx(x0)+'" cy="'+sy(fixedY)+'" r="5" fill="var(--discovery-fixed-point)" stroke="var(--paper)" stroke-width="2"/>';
  const movingMarker='<circle cx="'+sx(movingX)+'" cy="'+sy(movingY)+'" r="5" fill="var(--discovery-moving-point)" stroke="var(--paper)" stroke-width="2"/>';
  return '<svg data-plot-left="'+left+'" data-plot-width="'+plotWidth+'" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+h(sample.title)+' 的函数列图像，比较多个 n 的曲线"><title>'+h(sample.title)+' · n='+n+'</title>'+grid+paths+fixedMarker+movingMarker+'</svg>';
}

export function updateDiscoveryFigures(root){
  const page=root.querySelector('[data-discovery-selected]');if(!page)return;
  const sample=mathDiscoveryById(page.dataset.discoverySelected);if(!sample)return;
  const n=Math.max(1,Math.min(32,Number(root.querySelector('#discoveryN')?.value)||8));
  const domain=mathDiscoveryDomain(root.querySelector('#discoveryDomain')?.value),lo=domain.lo,hi=domain.hi;
  const ratio=Number(root.querySelector('#discoveryX')?.value??50)/100,x0=lo+(hi-lo)*ratio;
  const compareId=root.querySelector('#discoveryCompare')?.value||'',compare=mathDiscoveryById(compareId);
  const nLabel=root.querySelector('#discoveryNValue'),xLabel=root.querySelector('#discoveryXValue');
  if(nLabel)nLabel.textContent=String(n);if(xLabel)xLabel.textContent=fmt(x0);
  for(const button of root.querySelectorAll('[data-discovery-preset]'))button.setAttribute('aria-pressed',String(Number(button.dataset.discoveryPreset)===n));
  const plot=root.querySelector('#discoveryPlotPrimary');if(plot)plot.innerHTML=plotSvg(sample,n,lo,hi,x0);
  const legend=root.querySelector('#discoveryLegend');
  if(legend)legend.innerHTML=plotTerms(sample,n).map((term,index)=>'<span><i style="background:'+plotColor(term,n,index)+'"></i> '+inlineMathHtml('$n='+term+'$')+'</span>').join('')+'<span><i class="fixed"></i> 固定点</span><span><i class="moving"></i> 移动点</span>';
  const metrics=root.querySelector('#discoveryMetrics');
  const sup=sample.supValue(n,lo,hi),uniform=sample.uniformOnDomain(lo,hi);
  if(metrics)metrics.innerHTML='<div><small>'+(sample.integral?inlineMathHtml('阴影面积 $\\int f_n(x)\\,dx$'):'当前项数')+'</small><strong id="discoveryAreaOrTerm">'+(sample.integral?fmt(sample.integral(n,lo,hi)):'n = '+n)+'</strong></div><div><small>'+(sample.integral?'区间内峰高':'一致误差'+(sample.supKind==='bound'?'上界':'上确界'))+'</small><strong>'+(sample.supKind==='bound'?'≤ ':'= ')+fmt(sup)+'</strong></div><div><small>固定观察点</small><strong>'+inlineMathHtml('$f_n('+fmt(x0)+')='+fmt(sample.evaluate(x0,n))+'$')+'</strong></div>';
  const conclusion=root.querySelector('#discoveryConclusion');
  if(conclusion)conclusion.innerHTML='<p><strong>逐点极限：</strong>'+inlineMathHtml(sample.limitDescription)+'</p><p><strong>当前区间：</strong><span class="'+(uniform?'is-uniform':'is-not-uniform')+'">'+(uniform?'一致收敛到逐点极限':'不一致收敛到逐点极限')+'</span></p>';
  const table=root.querySelector('#discoveryPointTable');
  if(table){
    const ns=[...new Set([...(sample.integral?RIGOR_TERMS:[1,2,4,8,16]),n])].sort((a,b)=>a-b);
    const rows=ns.map(m=>{
      const moving=sample.movingPoint(m,lo,hi),fixedValue=sample.evaluate(x0,m),movingValue=sample.evaluate(moving,m);
      return '<tr><th scope="row">'+m+'</th><td>'+fmt(fixedValue)+'</td><td>'+fmt(moving)+'</td><td>'+fmt(movingValue)+'</td>'+(sample.integral?'<td>'+fmt(sample.integral(m,lo,hi))+'</td>':'')+'</tr>';
    }).join('');
    const labels=['$n$','固定点 $f_n(x_0)$','移动点 $x_n$','$f_n(x_n)$'];
    if(sample.integral)labels.push('区间积分');
    table.innerHTML='<table class="math-discovery-value-table"><thead><tr>'+labels.map(label=>'<th>'+inlineMathHtml(label)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>';
  }
  const comparePlot=root.querySelector('#discoveryComparePlot'),compareMetrics=root.querySelector('#discoveryCompareMetrics');
  if(compare&&compare.id!==sample.id){
    if(comparePlot)comparePlot.innerHTML='<h4>'+h(compare.title)+'</h4>'+plotSvg(compare,n,lo,hi,x0);
    if(compareMetrics){const uniform=compare.uniformOnDomain(lo,hi),sup=compare.supValue(n,lo,hi);compareMetrics.innerHTML='<details class="math-discovery-reveal"><summary>查看对照样本的数学结论</summary><p>'+inlineMathHtml(compare.limitDescription)+'</p><p><strong class="'+(uniform?'is-uniform':'is-not-uniform')+'">'+(uniform?'当前区间上一致收敛到逐点极限':'当前区间上不一致收敛到逐点极限')+'</strong></p><p>'+(compare.supKind==='bound'?'误差上界 ≤ ':'误差上确界 = ')+fmt(sup)+'</p></details>'}
  }else{if(comparePlot)comparePlot.innerHTML='<p class="math-discovery-empty">选择另一个样本，观察它与当前对象的异同。</p>';if(compareMetrics)compareMetrics.replaceChildren()}
}

export function buildDiscoveryPacket(root){
  const page=root.querySelector('[data-discovery-selected]'),sample=mathDiscoveryById(page?.dataset.discoverySelected);if(!sample)return null;
  const n=Number(root.querySelector('#discoveryN')?.value)||8,domain=mathDiscoveryDomain(root.querySelector('#discoveryDomain')?.value),ratio=Number(root.querySelector('#discoveryX')?.value??50)/100,x0=domain.lo+(domain.hi-domain.lo)*ratio;
  const compare=mathDiscoveryById(root.querySelector('#discoveryCompare')?.value||'');
  const note=field=>root.querySelector('[data-discovery-note="'+field+'"]')?.value||'';
  return {
    format:'lmn-math-discovery-context/1',
    createdAt:new Date().toISOString(),
    sample:{id:sample.id,title:sample.title,expression:sample.expression,description:sample.description,limitDescription:sample.limitDescription,observationPrompt:sample.observationPrompt},
    parameters:{n,domain:{lo:domain.lo,hi:domain.hi},fixedPoint:x0,movingPoint:sample.movingPoint(n,domain.lo,domain.hi)},
    observations:{fixedValue:sample.evaluate(x0,n),movingValue:sample.evaluate(sample.movingPoint(n,domain.lo,domain.hi),n),supOrBound:sample.supValue(n,domain.lo,domain.hi),uniformOnDomain:sample.uniformOnDomain(domain.lo,domain.hi),...(sample.integral?{integral:sample.integral(n,domain.lo,domain.hi)}:{})},
    comparison:compare?{id:compare.id,title:compare.title,expression:compare.expression}:null,
    notes:Object.fromEntries([...root.querySelectorAll('[data-discovery-note]')].map(field=>[field.dataset.discoveryNote,note(field.dataset.discoveryNote)])),
    relatedKnowledge:sample.knowledgeIds,
    relatedProblems:sample.problemIds,
    instruction:'请先帮助我整理观察到的现象、提出可检验的猜想，并指出还需要比较哪些样本。不要直接把猜想改写成定理，也不要省略可能的反例。'
  };
}
