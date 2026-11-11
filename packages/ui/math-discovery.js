import {MATH_DISCOVERY_CASES,mathDiscoveryById,mathDiscoveryDomain} from '../learning/math-discovery.js';
import {mathKnowledgeById,mathProblemById} from '../learning/math-content.js';

const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>{
  if(!Number.isFinite(value))return '—';
  if(value!==0&&Math.abs(value)<0.001)return value.toExponential(2);
  return Number(value).toFixed(3).replace(/\.?0+$/,'')||'0';
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const linkCard=(kind,id,title,detail)=>{
  return '<button type="button" class="math-item-card" data-archive-kind="'+h(kind)+'" data-id="'+h(id)+'"><span class="math-item-title">'+h(title)+'</span><small>'+h(detail||id)+'</small><span class="math-item-arrow" aria-hidden="true">↗</span></button>';
};

export function renderDiscoveryPage({selectedId='',compareId='',annotations=new Map()}={}){
  const selected=mathDiscoveryById(selectedId)||MATH_DISCOVERY_CASES[0];
  const compare=mathDiscoveryById(compareId)&&compareId!==selected.id?mathDiscoveryById(compareId):MATH_DISCOVERY_CASES.find(item=>item.id!==selected.id);
  const note=annotations.get('math-note:'+selected.id)||{};
  const cards=MATH_DISCOVERY_CASES.map(item=>'<button type="button" class="math-discovery-sample '+(item.id===selected.id?'active':'')+'" data-discovery-case="'+h(item.id)+'" aria-pressed="'+String(item.id===selected.id)+'"><span>'+h(item.group)+'</span><b>'+h(item.title)+'</b><small>'+h(item.expression)+'</small></button>').join('');
  const options=MATH_DISCOVERY_CASES.filter(item=>item.id!==selected.id).map(item=>'<option value="'+h(item.id)+'" '+(item.id===compare?.id?'selected':'')+'>'+h(item.title)+'</option>').join('');
  const knowledge=selected.knowledgeIds.map(id=>{const item=mathKnowledgeById(id);return item?linkCard('knowledge',id,item.title,item.kind):''}).join('');
  const problems=selected.problemIds.map(id=>{const item=mathProblemById(id);return item?linkCard('problem',id,item.title,item.type+' · 难度 '+item.difficulty):''}).join('');
  return '<div class="math-discovery-page" data-discovery-selected="'+h(selected.id)+'">'+
    '<section class="math-discovery-intro"><span class="math-kicker">MATHEMATICS · DISCOVERY STUDIO</span><h2>先看材料，再决定要问什么。</h2><p>这里不规定一条必须依次完成的学习路线。选择样本、改变参数、比较图像、追踪固定点或移动点；观察、猜想和疑问都可以随时记录。</p></section>'+
    '<section class="math-discovery-materials"><header><div><span class="math-kicker">OBSERVATION MATERIALS</span><h3>样本展柜</h3><p>同一主题下的不同函数列，提供可比较的具体材料。</p></div><span class="math-discovery-count">'+MATH_DISCOVERY_CASES.length+' 个样本</span></header><div class="math-discovery-sample-grid">'+cards+'</div></section>'+
    '<div class="math-discovery-layout"><main class="math-discovery-main">'+
      '<section class="math-discovery-paper"><header class="math-discovery-heading"><div><span class="math-kicker">'+h(selected.id)+' · '+h(selected.group)+'</span><h3>'+h(selected.title)+'</h3><p>'+h(selected.description)+'</p></div><span class="math-discovery-mark">∿</span></header>'+
        '<div class="math-discovery-formula" id="discoveryFormula">'+h(selected.expression)+'</div><section class="math-discovery-observation-prompt"><span>可以从这里开始观察（不是必须完成的步骤）</span><div id="discoveryPrompt"></div></section><details class="math-discovery-hint"><summary>需要时查看一条观察线索</summary><div id="discoveryPointwiseHint"></div></details>'+
        '<div class="math-discovery-controls"><label>项数 n <output id="discoveryNValue">8</output><input id="discoveryN" type="range" min="1" max="32" step="1" value="'+h(note.discoveryN??8)+'"></label><label>观察区间<select id="discoveryDomain"><option value="0:1" '+(note.discoveryDomain==='0:1'?'selected':'')+'>[0, 1]</option><option value="0:0.8" '+(note.discoveryDomain==='0:0.8'?'selected':'')+'>[0, 0.8]</option><option value="0.2:1" '+(note.discoveryDomain==='0.2:1'?'selected':'')+'>[0.2, 1]</option></select></label><label>固定观察点 x₀ <output id="discoveryXValue">0.5</output><input id="discoveryX" type="range" min="0" max="100" step="1" value="'+h(note.discoveryX??50)+'"></label></div>'+
        '<div class="math-discovery-plot-wrap"><div class="math-discovery-plot-head"><strong>图像比较</strong><span>显示 n = 1、2、4、8 与当前 n</span></div><div id="discoveryPlotPrimary" class="math-discovery-plot"></div><div id="discoveryLegend" class="math-discovery-legend"></div></div>'+
        '<div id="discoveryMetrics" class="math-discovery-metrics"></div><details class="math-discovery-reveal"><summary>完成观察后，再查看已知数学结论</summary><div id="discoveryConclusion"></div></details>'+
        '<section class="math-discovery-table-wrap"><h4>固定点与移动点的数值</h4><p>固定点 x₀ 不随 n 改变；移动点 xₙ 则根据样本的峰值或边界特征选取。</p><div id="discoveryPointTable"></div></section>'+
      '</section>'+
      '<section class="math-discovery-paper"><header><div><span class="math-kicker">RELATED MATERIAL</span><h3>相关知识与问题</h3><p>从一个样本可以进入多个知识点，也可以转向不同类型的题目。</p></div></header><div class="math-discovery-related"><section><h4>相关知识</h4><div class="math-compact-grid">'+knowledge+'</div></section><section><h4>相关习题</h4><div class="math-compact-grid">'+problems+'</div></section></div></section>'+
    '</main><aside class="math-discovery-side">'+
      '<section class="math-discovery-paper"><span class="math-kicker">COMPARISON</span><h3>再选一个样本</h3><label class="math-discovery-compare-label">对照对象<select id="discoveryCompare">'+options+'</select></label><div id="discoveryComparePlot" class="math-discovery-compare-plot"></div><div id="discoveryCompareMetrics"></div></section>'+
      '<section class="math-discovery-paper math-discovery-notes"><span class="math-kicker">PERSONAL RESEARCH NOTES</span><h3>记录正在形成的认识</h3><p>不必马上得出结论。可以先记下观察，再写猜想，也可以保留暂时无法解释的反例。</p>'+
        '<label>我观察到什么？<textarea data-discovery-note="observation" rows="4" placeholder="例如：固定 x 时数值趋于 0，但图像的峰值仍然很高……">'+h(note.observation||'')+'</textarea></label>'+
        '<label>我目前的猜想<textarea data-discovery-note="conjecture" rows="4" placeholder="尝试描述你发现的规律，不必担心是否正确。">'+h(note.conjecture||'')+'</textarea></label>'+
        '<label>反例、疑问或尚未解释的现象<textarea data-discovery-note="counterexample" rows="4" placeholder="什么情况可能推翻这个猜想？还有什么现象无法解释？">'+h(note.counterexample||'')+'</textarea></label>'+
        '<div class="math-discovery-note-actions"><button type="button" class="primary" data-discovery-action="copy">复制当前探索上下文给 AI</button><small id="discoveryStatus" role="status" aria-live="polite">观察记录会自动保存在本机，并可随个人批注一起导出。</small></div>'+
      '</section>'+
    '</aside></div></div>';
}

function plotSvg(sample,n,lo,hi,x0){
  const width=720,height=278,left=48,right=16,top=16,bottom=34,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const yMin=sample.yDomain[0],yMax=sample.yDomain[1],ySpan=yMax-yMin;
  const sx=x=>left+(x-lo)/(hi-lo)*plotWidth,sy=y=>top+(yMax-y)/ySpan*plotHeight;
  const series=[1,2,4,8,n].filter((value,index,array)=>array.indexOf(value)===index);
  const colors=['var(--discovery-series-a)','var(--discovery-series-b)','var(--discovery-series-c)','var(--discovery-series-d)','var(--discovery-series-current)'];
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
    paths+='<path d="'+d+'" fill="none" stroke="'+colors[index]+'" stroke-width="'+(m===n?2.7:1.6)+'" stroke-linecap="round" stroke-linejoin="round" opacity="'+(m===n?1:0.72)+'"/>';
  });
  const fixedY=clamp(sample.evaluate(x0,n),yMin,yMax),movingX=sample.movingPoint(n,lo,hi),movingY=clamp(sample.evaluate(movingX,n),yMin,yMax);
  const fixedMarker='<circle cx="'+sx(x0)+'" cy="'+sy(fixedY)+'" r="5" fill="var(--discovery-fixed-point)" stroke="var(--paper)" stroke-width="2"/>';
  const movingMarker='<circle cx="'+sx(movingX)+'" cy="'+sy(movingY)+'" r="5" fill="var(--discovery-moving-point)" stroke="var(--paper)" stroke-width="2"/>';
  return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+h(sample.title)+' 的函数列图像，比较多个 n 的曲线"><title>'+h(sample.title)+' · n='+n+'</title>'+grid+paths+fixedMarker+movingMarker+'</svg>';
}

export function updateDiscoveryFigures(root){
  const page=root.querySelector('[data-discovery-selected]');if(!page)return;
  const sample=mathDiscoveryById(page.dataset.discoverySelected);if(!sample)return;
  const n=Math.max(1,Math.min(32,Number(root.querySelector('#discoveryN')?.value)||8));
  const domain=mathDiscoveryDomain(root.querySelector('#discoveryDomain')?.value),lo=domain.lo,hi=domain.hi;
  const ratio=(Number(root.querySelector('#discoveryX')?.value)||50)/100,x0=lo+(hi-lo)*ratio;
  const compareId=root.querySelector('#discoveryCompare')?.value||'',compare=mathDiscoveryById(compareId);
  const nLabel=root.querySelector('#discoveryNValue'),xLabel=root.querySelector('#discoveryXValue');
  if(nLabel)nLabel.textContent=String(n);if(xLabel)xLabel.textContent=fmt(x0);
  const plot=root.querySelector('#discoveryPlotPrimary');if(plot)plot.innerHTML=plotSvg(sample,n,lo,hi,x0);
  const legend=root.querySelector('#discoveryLegend');
  if(legend){const ns=[1,2,4,8,n].filter((value,index,array)=>array.indexOf(value)===index),colors=['var(--discovery-series-a)','var(--discovery-series-b)','var(--discovery-series-c)','var(--discovery-series-d)','var(--discovery-series-current)'];legend.innerHTML=ns.map((value,index)=>'<span><i style="background:'+colors[index]+'"></i> n = '+value+'</span>').join('')+'<span><i class="fixed"></i> 固定点</span><span><i class="moving"></i> 移动点</span>'}
  const metrics=root.querySelector('#discoveryMetrics');
  const sup=sample.supValue(n,lo,hi),uniform=sample.uniformOnDomain(lo,hi);
  if(metrics)metrics.innerHTML='<div><small>当前项数</small><strong>n = '+n+'</strong></div><div><small>当前全域数值指标</small><strong>'+(sample.supKind==='bound'?'≤ ':'= ')+fmt(sup)+'</strong></div><div><small>固定观察点</small><strong>fₙ('+fmt(x0)+') = '+fmt(sample.evaluate(x0,n))+'</strong></div><p>当前定义域为 ['+fmt(lo)+', '+fmt(hi)+']。图像、固定点和移动点的数值可以相互对照；这里暂不预先给出结论。</p>';
  const conclusion=root.querySelector('#discoveryConclusion');
  if(conclusion)conclusion.innerHTML='<p><strong>逐点极限：</strong>'+h(sample.limitDescription)+'</p><p><strong>当前定义域上的一致性：</strong><span class="'+(uniform?'is-uniform':'is-not-uniform')+'">'+(uniform?'一致趋于 0':'不一致趋于 0')+'</span></p><p><strong>当前误差'+(sample.supKind==='bound'?'上界':'上确界')+'：</strong>'+(sample.supKind==='bound'?'≤ ':'= ')+fmt(sup)+'</p>';
  const table=root.querySelector('#discoveryPointTable');
  if(table){
    const ns=[1,2,4,8,16,n].filter((value,index,array)=>array.indexOf(value)===index);
    const rows=ns.map(m=>{
      const moving=sample.movingPoint(m,lo,hi),fixedValue=sample.evaluate(x0,m),movingValue=sample.evaluate(moving,m);
      return '<tr><th>'+m+'</th><td>'+fmt(fixedValue)+'</td><td>'+fmt(moving)+'</td><td>'+fmt(movingValue)+'</td></tr>';
    }).join('');
    table.innerHTML='<table class="math-discovery-value-table"><thead><tr><th>n</th><th>固定点 fₙ(x₀)</th><th>移动点 xₙ</th><th>fₙ(xₙ)</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  const comparePlot=root.querySelector('#discoveryComparePlot'),compareMetrics=root.querySelector('#discoveryCompareMetrics');
  if(compare&&compare.id!==sample.id){
    if(comparePlot)comparePlot.innerHTML='<h4>'+h(compare.title)+'</h4>'+plotSvg(compare,n,lo,hi,x0);
    if(compareMetrics){const uniform=compare.uniformOnDomain(lo,hi),sup=compare.supValue(n,lo,hi);compareMetrics.innerHTML='<details class="math-discovery-reveal"><summary>查看对照样本的数学结论</summary><p>'+h(compare.limitDescription)+'</p><p><strong class="'+(uniform?'is-uniform':'is-not-uniform')+'">'+(uniform?'当前区间上一致趋于 0':'当前区间上不一致趋于 0')+'</strong></p><p>'+(compare.supKind==='bound'?'误差上界 ≤ ':'误差上确界 = ')+fmt(sup)+'</p></details>'}
  }else{if(comparePlot)comparePlot.innerHTML='<p class="math-discovery-empty">选择另一个样本，观察它与当前对象的异同。</p>';if(compareMetrics)compareMetrics.replaceChildren()}
}

export function buildDiscoveryPacket(root){
  const page=root.querySelector('[data-discovery-selected]'),sample=mathDiscoveryById(page?.dataset.discoverySelected);if(!sample)return null;
  const n=Number(root.querySelector('#discoveryN')?.value)||8,domain=mathDiscoveryDomain(root.querySelector('#discoveryDomain')?.value),ratio=(Number(root.querySelector('#discoveryX')?.value)||50)/100,x0=domain.lo+(domain.hi-domain.lo)*ratio;
  const compare=mathDiscoveryById(root.querySelector('#discoveryCompare')?.value||'');
  const note=field=>root.querySelector('[data-discovery-note="'+field+'"]')?.value||'';
  return {
    format:'lmn-math-discovery-context/1',
    createdAt:new Date().toISOString(),
    sample:{id:sample.id,title:sample.title,expression:sample.expression,description:sample.description,limitDescription:sample.limitDescription,observationPrompt:sample.observationPrompt},
    parameters:{n,domain:{lo:domain.lo,hi:domain.hi},fixedPoint:x0,movingPoint:sample.movingPoint(n,domain.lo,domain.hi)},
    observations:{fixedValue:sample.evaluate(x0,n),movingValue:sample.evaluate(sample.movingPoint(n,domain.lo,domain.hi),n),supOrBound:sample.supValue(n,domain.lo,domain.hi),uniformOnDomain:sample.uniformOnDomain(domain.lo,domain.hi)},
    comparison:compare?{id:compare.id,title:compare.title,expression:compare.expression}:null,
    notes:{observation:note('observation'),conjecture:note('conjecture'),counterexample:note('counterexample')},
    relatedKnowledge:sample.knowledgeIds,
    relatedProblems:sample.problemIds,
    instruction:'请先帮助我整理观察到的现象、提出可检验的猜想，并指出还需要比较哪些样本。不要直接把猜想改写成定理，也不要省略可能的反例。'
  };
}
