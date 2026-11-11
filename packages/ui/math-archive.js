import {list,put} from '../../apps/web/db.js';
import {MATH_CONTENT_VERSION,MATH_COURSES,MATH_KNOWLEDGE,MATH_METHODS,MATH_PROBLEMS,mathCourseById,mathKnowledgeById,mathMethodById,mathProblemById,mathProblemsForKnowledge,mathProblemsForMethod,searchMathContent} from '../learning/math-content.js';
import {appendInlineContent,renderStudyMarkdown} from './math-markup.js';
import {mathDiscoveryById} from '../learning/math-discovery.js';
import {renderDiscoveryPage,updateDiscoveryFigures,buildDiscoveryPacket} from './math-discovery.js';

const $=selector=>document.querySelector(selector);
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const viewNames={courses:'课程',course:'课程',discovery:'发现室',problems:'题库',problem:'题库',knowledge:'知识库',methods:'方法库',method:'方法库',search:'全站数学检索',about:'关于'};
const masteryLabels=['未学习','初步理解','提示下完成','独立完成','可迁移运用'];
const annotationId=id=>`math-note:${id}`;
const archiveButton=(kind,id,title,detail='')=>`<button type="button" class="math-item-card" data-archive-kind="${h(kind)}" data-id="${h(id)}"><span class="math-item-title" data-math-inline="${h(title)}"></span><small>${h(detail)}</small><span class="math-item-arrow" aria-hidden="true">↗</span></button>`;
const renderInlineTitles=root=>{for(const item of root.querySelectorAll('[data-math-inline]')){item.replaceChildren();appendInlineContent(item,item.dataset.mathInline)}};
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export class MathArchive{
  constructor(controller){this.controller=controller;this.annotations=new Map();this.search={problems:'',knowledge:'',methods:'',search:''};this.filters={difficulty:'',type:''};this.timers=new Map();this.notice='';this.discoverySelectedId='SEQ-POWER';this.discoveryCompareId='SEQ-SPIKE';}
  async load(){for(const note of await list('mathAnnotations'))this.annotations.set(note.id,note);this.bind()}
  bind(){const root=$('#mathArchive');root.addEventListener('click',event=>{
    const button=event.target.closest('[data-archive-kind], [data-math-archive-action], [data-discovery-case], [data-discovery-action]');if(!button)return;
    if(button.dataset.discoveryCase){this.controller.openMathArchive('discovery',button.dataset.discoveryCase);return}
    if(button.dataset.discoveryAction==='copy'){this.copyDiscoveryContext();return}
    if(button.dataset.archiveKind){this.controller.openMathArchive(button.dataset.archiveKind,button.dataset.id);return}
    const action=button.dataset.mathArchiveAction,id=button.dataset.id;
    if(action==='start')this.controller.studyWorkbench.startProblem(id);
    else if(action==='copy')this.copyProblem(id);
    else if(action==='home')this.controller.openMathHome();
    else if(action==='export')download('LMN-数学个人批注.json',{format:'lmn-math-annotations/1',contentVersion:MATH_CONTENT_VERSION,exportedAt:new Date().toISOString(),annotations:[...this.annotations.values()]});
    else if(action==='import')$('#mathAnnotationsImport')?.click();
    else if(action==='toolbox')this.controller.openMathToolbox();
  });
    root.addEventListener('input',event=>{
      if(event.target.id==='mathSearch'){const section=event.target.dataset.section;this.search[section]=event.target.value;this.renderListResults(section)}
      if(event.target.id==='mathPrivateNote'){this.updateAnnotation(event.target.dataset.id,{body:event.target.value})}
      if(event.target.matches('[data-discovery-note]'))this.updateAnnotation(this.discoverySelectedId,{[event.target.dataset.discoveryNote]:event.target.value});
      if(event.target.id==='discoveryN'){this.updateAnnotation(this.discoverySelectedId,{discoveryN:Number(event.target.value)});updateDiscoveryFigures(root)}
      if(event.target.id==='discoveryX'){this.updateAnnotation(this.discoverySelectedId,{discoveryX:Number(event.target.value)});updateDiscoveryFigures(root)}
    });
    root.addEventListener('change',event=>{
      if(event.target.id==='mathDifficulty'){this.filters.difficulty=event.target.value;this.renderListResults('problems')}
      if(event.target.id==='mathType'){this.filters.type=event.target.value;this.renderListResults('problems')}
      if(event.target.id==='mathMastery'){this.updateAnnotation(event.target.dataset.id,{mastery:event.target.value})}
      if(event.target.id==='mathAnnotationsImport')this.importAnnotations(event.target);
      if(event.target.id==='discoveryDomain'){this.updateAnnotation(this.discoverySelectedId,{discoveryDomain:event.target.value});updateDiscoveryFigures(root)}
      if(event.target.id==='discoveryCompare'){this.discoveryCompareId=event.target.value;this.updateAnnotation(this.discoverySelectedId,{discoveryCompareId:event.target.value});updateDiscoveryFigures(root)}
    });
  }
  updateAnnotation(id,patch){if(!this.validAnnotationTarget(id))return;const key=annotationId(id),old=this.annotations.get(key)??{id:key,subjectId:id,body:'',mastery:'未学习'};
    const next={...old,...patch,updatedAt:new Date().toISOString()};this.annotations.set(key,next);clearTimeout(this.timers.get(key));this.timers.set(key,setTimeout(()=>{this.timers.delete(key);put('mathAnnotations',this.annotations.get(key)).catch(error=>this.showNotice(`批注保存失败：${error.message}`))},400));
    this.showNotice('私人批注已更新，将保存在当前浏览器中。');
  }
  validAnnotationTarget(id){return Boolean(mathKnowledgeById(id)||mathProblemById(id)||mathMethodById(id)||mathDiscoveryById(id))}
  async flushAnnotations(){
    const pending=[...this.timers.keys()].map(key=>this.annotations.get(key));
    for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();
    await Promise.all(pending.map(note=>put('mathAnnotations',note)));
  }
  showNotice(value){this.notice=value;const target=$('#mathArchiveStatus');if(target)target.textContent=value}
  async importAnnotations(input){const file=input.files?.[0];input.value='';if(!file)return;
    try{if(file.size>5*1024*1024)throw new Error('文件不能超过 5MB');const data=JSON.parse(await file.text());
      if(data?.format!=='lmn-math-annotations/1'||!Array.isArray(data.annotations)||data.annotations.length>20000)throw new Error('不是受支持的个人批注文件');
      const seen=new Set(),incoming=[];for(const item of data.annotations){if(!item||!this.validAnnotationTarget(item.subjectId)||item.id!==annotationId(item.subjectId)||typeof item.body!=='string'||item.body.length>100000||!masteryLabels.includes(item.mastery)||typeof item.updatedAt!=='string'||!Number.isFinite(Date.parse(item.updatedAt))||new Date(item.updatedAt).toISOString()!==item.updatedAt||seen.has(item.id)||(['observation','conjecture','counterexample'].some(field=>item[field]!==undefined&&(typeof item[field]!=='string'||item[field].length>100000))||(item.discoveryN!==undefined&&(!Number.isInteger(item.discoveryN)||item.discoveryN<1||item.discoveryN>32))||(item.discoveryX!==undefined&&(!Number.isInteger(item.discoveryX)||item.discoveryX<0||item.discoveryX>100))||(item.discoveryDomain!==undefined&&!['0:1','0:0.8','0.2:1'].includes(item.discoveryDomain))||(item.discoveryCompareId!==undefined&&(!mathDiscoveryById(item.discoveryCompareId)||item.discoveryCompareId===item.subjectId))))throw new Error('批注数据存在无效或重复记录');seen.add(item.id);incoming.push(item)}
      // Finish pending local saves before merging, so a debounce timer cannot undo the import.
      await this.flushAnnotations();
      let count=0;for(const item of incoming){const current=this.annotations.get(item.id);if(!current||String(item.updatedAt)>String(current.updatedAt)){await put('mathAnnotations',item);this.annotations.set(item.id,item);count++}}
      this.showNotice(`批注导入完成，更新 ${count} 条；本地较新的记录已保留。`);this.render();
    }catch(error){this.showNotice(`导入失败：${error.message}`)}
  }
  async copyProblem(id){const problem=mathProblemById(id);if(!problem)return;
    const text=`# ${problem.title}\n编号：${problem.id}\n\n${problem.prompt}\n\n关联知识：${problem.knowledgeIds.map(k=>mathKnowledgeById(k)?.title).join('、')}\n\n请作为数学学习教练，先给我最小提示，不要立即展示完整解答。`;
    try{await navigator.clipboard.writeText(text);this.showNotice('已复制题目和 AI 辅导请求（不包含答案）。')}catch{this.showNotice('浏览器禁止剪贴板操作，请进入解题工作台下载 AI 请求。')}
  }
  render(){const documentId=this.controller.document;if(!documentId.startsWith('math-archive:'))return;
    const [,view,id='']=documentId.split(':'),root=$('#mathArchive');if(!root)return;
    const title=viewNames[view]??'数学档案';
    root.innerHTML=`<div class="math-archive-shell"><header class="math-archive-page-head"><button type="button" class="math-archive-back" data-math-archive-action="home">← 学习首页</button><span class="math-kicker">MATHEMATICS · LMN ARCHIVE</span><h1>${h(title)}</h1><p>${view==='discovery'?'从具体样本出发，观察变化、比较差异、记录猜想与反例；没有必须遵循的固定步骤。':'让知识、问题、方法与个人理解彼此关联，保留每一次探索的过程。'}</p></header><div id="mathArchiveContent"></div><footer class="math-archive-footer"><button type="button" data-math-archive-action="export">导出我的全部批注 JSON</button><button type="button" data-math-archive-action="import">导入个人批注</button><input type="file" class="hidden" id="mathAnnotationsImport" accept=".json,application/json"><button type="button" data-math-archive-action="toolbox">打开知识工具箱</button><p id="mathArchiveStatus" role="status" aria-live="polite">${h(this.notice||'公开教材随网站版本更新；个人批注仅保存在本浏览器，请定期备份。')}</p></footer></div>`;
    if(view==='courses')this.renderCourses();else if(view==='course')this.renderCourse(id);else if(view==='discovery')this.renderDiscoveries(id);else if(view==='search'||view==='problems'||view==='knowledge'&&!id||view==='methods')this.renderList(view);else if(view==='problem')this.renderProblem(id);else if(view==='method')this.renderMethod(id);else if(view==='about')this.renderAbout();else this.renderKnowledge(id);
    renderInlineTitles(root);
  }
  renderCourses(){const root=$('#mathArchiveContent');root.innerHTML=`<section class="math-archive-intro"><h2>公开课程</h2><p>以下教学内容可直接阅读，无需导入。个人课程仍在原工作区中独立保存。</p></section><div class="math-catalog-list">${MATH_COURSES.map(course=>archiveButton('course',course.id,course.title,`${course.chapters.length} 个完整专题 · ${course.description}`)).join('')}</div><section class="math-archive-note"><h3>我的课程与知识</h3><p>已有 Knowledge/LKL3 工作区仍然可用。通过首页的“我的课程”管理私人内容，不会与公开课程混合覆盖。</p><button type="button" data-math-archive-action="home">返回我的课程入口</button></section>`}
  renderCourse(id){const course=mathCourseById(id);const root=$('#mathArchiveContent');if(!course){this.notFound();return}
    root.innerHTML=`<section class="math-archive-intro"><h2>${h(course.title)}</h2><p>${h(course.description)}</p></section>${course.chapters.map(chapter=>`<section class="math-chapter-card"><div class="math-chapter-head"><span class="math-kicker">已发布教学单元</span><h2>${h(chapter.title)}</h2><p>${h(chapter.description)}</p></div><h3>知识路线</h3><div class="math-compact-grid">${chapter.knowledgeIds.map(shortId=>{const item=mathKnowledgeById(`ANA-UC-${shortId}`);return archiveButton('knowledge',item.id,item.title,item.kind)}).join('')}</div><h3>习题训练</h3><div class="math-compact-grid">${chapter.problemIds.map(shortId=>{const item=mathProblemById(`ANA-UC-${shortId}`);return archiveButton('problem',item.id,item.title,`${item.type} · 难度 ${item.difficulty}`)}).join('')}</div></section>`).join('')}`}
  renderList(section){const root=$('#mathArchiveContent'),items=section==='problems'?MATH_PROBLEMS:section==='knowledge'?MATH_KNOWLEDGE:section==='methods'?MATH_METHODS:[...MATH_PROBLEMS,...MATH_KNOWLEDGE,...MATH_METHODS];
    const label=section==='problems'?'题目':section==='knowledge'?'知识档案':section==='methods'?'方法档案':'公开数学档案';
    root.innerHTML=`<section class="math-archive-intro"><h2>${label}检索</h2><p>已经发布 ${items.length} 个真实内容条目。题目与知识可以相互追溯，所有正文均可阅读。</p></section><div class="math-archive-filters"><label>关键词搜索<input type="search" id="mathSearch" data-section="${section}" value="${h(this.search[section]??'')}" placeholder="搜索概念、题目或方法…"></label>${section==='problems'?`<label>难度<select id="mathDifficulty"><option value="">全部难度</option>${[1,2,3,4].map(level=>`<option value="${level}" ${this.filters.difficulty===String(level)?'selected':''}>${level}</option>`).join('')}</select></label><label>题型<select id="mathType"><option value="">全部题型</option>${[...new Set(MATH_PROBLEMS.map(p=>p.type))].map(type=>`<option value="${h(type)}" ${this.filters.type===type?'selected':''}>${h(type)}</option>`).join('')}</select></label>`:''}</div><p id="mathArchiveCount" class="math-archive-count"></p><div id="mathArchiveResults" class="math-catalog-list"></div>`;
    this.renderListResults(section);
  }
  renderListResults(section){const root=$('#mathArchiveResults'),count=$('#mathArchiveCount');if(!root||!count)return;
    const items=section==='problems'?MATH_PROBLEMS:section==='knowledge'?MATH_KNOWLEDGE:section==='methods'?MATH_METHODS:[...MATH_PROBLEMS,...MATH_KNOWLEDGE,...MATH_METHODS],results=searchMathContent(items,{text:this.search[section],...(section==='problems'?this.filters:{})});
    count.textContent=`${results.length} / ${items.length} 个条目`;
    root.innerHTML=results.map(item=>archiveButton(item.id.includes('-P')?'problem':item.id.includes('-K')?'knowledge':'method',item.id,item.title,item.prompt?`${item.id} · ${item.type} · 难度 ${item.difficulty}`:item.summary??item.trigger)).join('')||'<p class="math-archive-empty">没有找到匹配条目。可以尝试其他关键词。</p>';renderInlineTitles(root);
  }
  renderKnowledge(id){const knowledge=mathKnowledgeById(id);if(!knowledge){this.notFound();return}const related=mathProblemsForKnowledge(id);
    $('#mathArchiveContent').innerHTML=`<article class="math-reading-layout"><div class="math-reading-main"><div class="math-reading-paper"><span class="math-kicker">知识档案 · ${h(knowledge.id)} · ${h(knowledge.kind)}</span><h2>${h(knowledge.title)}</h2><p class="math-reading-summary">${h(knowledge.summary)}</p><div class="math-reading-body" id="mathReadingBody"></div></div><section class="math-reading-paper"><h3>关联习题</h3><div class="math-compact-grid">${related.map(item=>archiveButton('problem',item.id,item.title,`难度 ${item.difficulty} · ${item.type}`)).join('')}</div></section></div><aside class="math-reading-side"><section class="math-reading-paper"><h3>前置知识</h3>${knowledge.prerequisites.length?knowledge.prerequisites.map(x=>archiveButton('knowledge',x,mathKnowledgeById(x)?.title??x)).join(''):'<p>本专题的基础入口。</p>'}<h3>学习证据</h3><p>${h(this.evidence(knowledge.id))}</p></section>${this.annotationSection(knowledge.id)}</aside></article>`;
    renderStudyMarkdown($('#mathReadingBody'),knowledge.body);
  }
  renderProblem(id){const problem=mathProblemById(id);if(!problem){this.notFound();return}
    $('#mathArchiveContent').innerHTML=`<article class="math-reading-layout"><div class="math-reading-main"><div class="math-reading-paper"><span class="math-kicker">习题档案 · ${h(problem.id)} · 难度 ${problem.difficulty}</span><h2>${h(problem.title)}</h2><p class="math-reading-summary">${h(problem.type)} · 原创习题 · 数学分析（二）</p><div class="math-reading-body" id="mathReadingBody"></div><div class="math-problem-actions"><button type="button" class="primary" data-math-archive-action="start" data-id="${h(problem.id)}">开始独立解题 →</button><button type="button" data-math-archive-action="copy" data-id="${h(problem.id)}">复制题目给 AI</button></div></div><section class="math-reading-paper"><h3>分层提示</h3><p>解题工作台会在你提交首次尝试后逐步解锁提示。这里的参考解答默认折叠。</p><details class="math-optional-solution"><summary>查看题目提示与参考解答</summary><div id="mathReadingHints"></div><h4>参考解答</h4><div id="mathReadingSolution"></div></details></section><section class="math-reading-paper"><h3>迁移训练</h3><div id="mathReadingTransfer" class="math-reading-body"></div></section></div><aside class="math-reading-side"><section class="math-reading-paper"><h3>解题需要哪些知识？</h3>${problem.knowledgeIds.map(x=>archiveButton('knowledge',x,mathKnowledgeById(x)?.title??x)).join('')}<h3>可能使用的方法</h3>${problem.methodIds.map(x=>archiveButton('method',x,mathMethodById(x)?.title??x)).join('')}<h3>我的学习证据</h3><p>${h(this.evidence(problem.id))}</p></section>${this.annotationSection(problem.id)}</aside></article>`;
    renderStudyMarkdown($('#mathReadingBody'),problem.prompt);renderStudyMarkdown($('#mathReadingHints'),problem.hints.map((hint,i)=>`${i+1}. ${hint}`).join('\n'));renderStudyMarkdown($('#mathReadingSolution'),problem.solution);renderStudyMarkdown($('#mathReadingTransfer'),problem.transfer);const title=$('#mathArchiveContent h2');title.replaceChildren();appendInlineContent(title,problem.title);
  }
  renderMethod(id){const method=mathMethodById(id);if(!method){this.notFound();return}
    $('#mathArchiveContent').innerHTML=`<article class="math-reading-layout"><div class="math-reading-main"><div class="math-reading-paper"><span class="math-kicker">方法档案 · ${h(id)}</span><h2>${h(method.title)}</h2><dl class="math-method-definition"><dt>触发条件</dt><dd id="mathMethodTrigger"></dd><dt>核心动作</dt><dd id="mathMethodAction"></dd><dt>有效原因</dt><dd id="mathMethodReason"></dd><dt>适用边界</dt><dd id="mathMethodBoundary"></dd></dl></div><section class="math-reading-paper"><h3>使用此方法的习题</h3><div class="math-compact-grid">${mathProblemsForMethod(id).map(item=>archiveButton('problem',item.id,item.title,`难度 ${item.difficulty}`)).join('')}</div></section></div><aside class="math-reading-side"><section class="math-reading-paper"><h3>相关知识</h3>${method.knowledgeIds.map(x=>archiveButton('knowledge',x,mathKnowledgeById(x)?.title??x)).join('')}</section>${this.annotationSection(id)}</aside></article>`;
    for(const [selector,text]of [['#mathMethodTrigger',method.trigger],['#mathMethodAction',method.action],['#mathMethodReason',method.reason],['#mathMethodBoundary',method.boundary]])renderStudyMarkdown($(selector),text);
  }
  renderDiscoveries(id=''){
    const selected=mathDiscoveryById(id)||mathDiscoveryById(this.discoverySelectedId);
    if(!selected){this.notFound();return}
    this.discoverySelectedId=selected.id;
    const savedNote=this.annotations.get(annotationId(selected.id));if(savedNote?.discoveryCompareId)this.discoveryCompareId=savedNote.discoveryCompareId;
    const compare=mathDiscoveryById(this.discoveryCompareId)&&this.discoveryCompareId!==selected.id?this.discoveryCompareId:(selected.id==='SEQ-SPIKE'?'SEQ-POWER':'SEQ-SPIKE');
    this.discoveryCompareId=compare;
    $('#mathArchiveContent').innerHTML=renderDiscoveryPage({selectedId:selected.id,compareId:compare,annotations:this.annotations});
    const formula=$('#discoveryFormula');if(formula)renderStudyMarkdown(formula,'$'+selected.latex+'$');
    const prompt=$('#discoveryPrompt');if(prompt)renderStudyMarkdown(prompt,selected.observationPrompt);
    const hint=$('#discoveryPointwiseHint');if(hint)renderStudyMarkdown(hint,selected.pointwiseHint);
    updateDiscoveryFigures($('#mathArchive'));
  }
  copyDiscoveryContext(){
    const root=$('#mathArchive'),packet=buildDiscoveryPacket(root);if(!packet)return;
    const text=JSON.stringify(packet,null,2)+'\n\n请先帮助我整理观察到的现象、提出可检验的猜想，并指出还需要比较哪些样本。不要直接把猜想改写成定理，也不要省略可能的反例。';
    const fallback=()=>{download('LMN-数学发现上下文.json',packet);const status=$('#discoveryStatus');if(status)status.textContent='已下载探索上下文 JSON，可交给 AI 分析。'};
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>{const status=$('#discoveryStatus');if(status)status.textContent='已复制当前样本、参数、数值与个人观察，可直接交给 AI。'}).catch(fallback);else fallback();
  }
  renderAbout(){$('#mathArchiveContent').innerHTML=`<article class="math-reading-paper math-about"><h2>关于 数学 · LMN</h2><p>这是 LMN 系列的数学学习与研究工作台。项目希望让数学知识不仅能够被阅读，还能够被独立尝试、检验、修订和保存。</p><p>公开课程与参考教案由网站维护；你的个人批注、知识结构与解题记录保存在当前浏览器。站点尚未提供账号和云同步，换设备前请分别导出知识、学习会话和批注。</p><h3>LMN 系列</h3><ul><li><a href="https://lmn-joeyce.com/" target="_blank" rel="noopener noreferrer">易学 · LMN</a></li><li><a href="https://albuscannybean.github.io/s/apps/web/" target="_blank" rel="noopener noreferrer">数学 · LMN</a></li></ul><p><a href="https://github.com/albuscannybean/s" target="_blank" rel="noopener noreferrer">GitHub 源代码与项目进展 ↗</a></p><p>本批数学分析内容为原创教学资料。参考解答应作为核对依据，不能代替独立证明与批判性检查。</p></article>`}
  annotationSection(subjectId){const note=this.annotations.get(annotationId(subjectId));return `<section class="math-reading-paper math-private-annotation"><span class="math-kicker">PRIVATE · 仅在本机</span><h3>我的理解与批注</h3><label>掌握情况<select id="mathMastery" data-id="${h(subjectId)}">${masteryLabels.map(label=>`<option value="${h(label)}" ${note?.mastery===label?'selected':''}>${h(label)}</option>`).join('')}</select></label><label>记录我的理解、问题或解题线索<textarea id="mathPrivateNote" rows="8" data-id="${h(subjectId)}" placeholder="这篇知识在我看来意味着什么？我还没解决的问题是什么？">${h(note?.body??'')}</textarea></label><small>自动保存到浏览器；导出批注才能在其他设备恢复。</small></section>`}
  evidence(id){const related=this.controller.studyWorkbench.sessions.filter(s=>s.problemId===id||(mathKnowledgeById(id)&&mathProblemById(s.problemId)?.knowledgeIds.includes(id)));
    if(!related.length)return '暂无关联练习。可以从相关习题开始独立尝试。';const attempts=related.reduce((count,s)=>count+s.attempts.length,0);
    return `${related.length} 个关联学习会话 · ${attempts} 次正式尝试；这些只是学习记录，不能自动认定为掌握。`;
  }
  notFound(){$('#mathArchiveContent').innerHTML='<div class="math-archive-empty"><h2>没有找到这个档案</h2><p>链接可能来自较新的内容版本，请通过上方导航重新检索。</p></div>'}
}
+selected.latex+';
    const prompt=$('#discoveryPrompt');if(prompt)renderStudyMarkdown(prompt,selected.observationPrompt);
    const hint=$('#discoveryPointwiseHint');if(hint)renderStudyMarkdown(hint,selected.pointwiseHint);
    updateDiscoveryFigures($('#mathArchive'));
  }
  copyDiscoveryContext(){
    const root=$('#mathArchive'),packet=buildDiscoveryPacket(root);if(!packet)return;
    const text=JSON.stringify(packet,null,2)+'\n\n请先帮助我整理观察到的现象、提出可检验的猜想，并指出还需要比较哪些样本。不要直接把猜想改写成定理，也不要省略可能的反例。';
    const fallback=()=>{download('LMN-数学发现上下文.json',packet);const status=$('#discoveryStatus');if(status)status.textContent='已下载探索上下文 JSON，可交给 AI 分析。'};
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>{const status=$('#discoveryStatus');if(status)status.textContent='已复制当前样本、参数、数值与个人观察，可直接交给 AI。'}).catch(fallback);else fallback();
  }
  renderAbout(){$('#mathArchiveContent').innerHTML=`<article class="math-reading-paper math-about"><h2>关于 数学 · LMN</h2><p>这是 LMN 系列的数学学习与研究工作台。项目希望让数学知识不仅能够被阅读，还能够被独立尝试、检验、修订和保存。</p><p>公开课程与参考教案由网站维护；你的个人批注、知识结构与解题记录保存在当前浏览器。站点尚未提供账号和云同步，换设备前请分别导出知识、学习会话和批注。</p><h3>LMN 系列</h3><ul><li><a href="https://lmn-joeyce.com/" target="_blank" rel="noopener noreferrer">易学 · LMN</a></li><li><a href="https://albuscannybean.github.io/s/apps/web/" target="_blank" rel="noopener noreferrer">数学 · LMN</a></li></ul><p><a href="https://github.com/albuscannybean/s" target="_blank" rel="noopener noreferrer">GitHub 源代码与项目进展 ↗</a></p><p>本批数学分析内容为原创教学资料。参考解答应作为核对依据，不能代替独立证明与批判性检查。</p></article>`}
  annotationSection(subjectId){const note=this.annotations.get(annotationId(subjectId));return `<section class="math-reading-paper math-private-annotation"><span class="math-kicker">PRIVATE · 仅在本机</span><h3>我的理解与批注</h3><label>掌握情况<select id="mathMastery" data-id="${h(subjectId)}">${masteryLabels.map(label=>`<option value="${h(label)}" ${note?.mastery===label?'selected':''}>${h(label)}</option>`).join('')}</select></label><label>记录我的理解、问题或解题线索<textarea id="mathPrivateNote" rows="8" data-id="${h(subjectId)}" placeholder="这篇知识在我看来意味着什么？我还没解决的问题是什么？">${h(note?.body??'')}</textarea></label><small>自动保存到浏览器；导出批注才能在其他设备恢复。</small></section>`}
  evidence(id){const related=this.controller.studyWorkbench.sessions.filter(s=>s.problemId===id||(mathKnowledgeById(id)&&mathProblemById(s.problemId)?.knowledgeIds.includes(id)));
    if(!related.length)return '暂无关联练习。可以从相关习题开始独立尝试。';const attempts=related.reduce((count,s)=>count+s.attempts.length,0);
    return `${related.length} 个关联学习会话 · ${attempts} 次正式尝试；这些只是学习记录，不能自动认定为掌握。`;
  }
  notFound(){$('#mathArchiveContent').innerHTML='<div class="math-archive-empty"><h2>没有找到这个档案</h2><p>链接可能来自较新的内容版本，请通过上方导航重新检索。</p></div>'}
}
);
    const prompt=$('#discoveryPrompt');if(prompt)renderStudyMarkdown(prompt,selected.observationPrompt);
    const hint=$('#discoveryPointwiseHint');if(hint)renderStudyMarkdown(hint,selected.pointwiseHint);
    updateDiscoveryFigures($('#mathArchive'));
  }
  copyDiscoveryContext(){
    const root=$('#mathArchive'),packet=buildDiscoveryPacket(root);if(!packet)return;
    const text=JSON.stringify(packet,null,2)+'\n\n请先帮助我整理观察到的现象、提出可检验的猜想，并指出还需要比较哪些样本。不要直接把猜想改写成定理，也不要省略可能的反例。';
    const fallback=()=>{download('LMN-数学发现上下文.json',packet);const status=$('#discoveryStatus');if(status)status.textContent='已下载探索上下文 JSON，可交给 AI 分析。'};
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>{const status=$('#discoveryStatus');if(status)status.textContent='已复制当前样本、参数、数值与个人观察，可直接交给 AI。'}).catch(fallback);else fallback();
  }
  renderAbout(){$('#mathArchiveContent').innerHTML=`<article class="math-reading-paper math-about"><h2>关于 数学 · LMN</h2><p>这是 LMN 系列的数学学习与研究工作台。项目希望让数学知识不仅能够被阅读，还能够被独立尝试、检验、修订和保存。</p><p>公开课程与参考教案由网站维护；你的个人批注、知识结构与解题记录保存在当前浏览器。站点尚未提供账号和云同步，换设备前请分别导出知识、学习会话和批注。</p><h3>LMN 系列</h3><ul><li><a href="https://lmn-joeyce.com/" target="_blank" rel="noopener noreferrer">易学 · LMN</a></li><li><a href="https://albuscannybean.github.io/s/apps/web/" target="_blank" rel="noopener noreferrer">数学 · LMN</a></li></ul><p><a href="https://github.com/albuscannybean/s" target="_blank" rel="noopener noreferrer">GitHub 源代码与项目进展 ↗</a></p><p>本批数学分析内容为原创教学资料。参考解答应作为核对依据，不能代替独立证明与批判性检查。</p></article>`}
  annotationSection(subjectId){const note=this.annotations.get(annotationId(subjectId));return `<section class="math-reading-paper math-private-annotation"><span class="math-kicker">PRIVATE · 仅在本机</span><h3>我的理解与批注</h3><label>掌握情况<select id="mathMastery" data-id="${h(subjectId)}">${masteryLabels.map(label=>`<option value="${h(label)}" ${note?.mastery===label?'selected':''}>${h(label)}</option>`).join('')}</select></label><label>记录我的理解、问题或解题线索<textarea id="mathPrivateNote" rows="8" data-id="${h(subjectId)}" placeholder="这篇知识在我看来意味着什么？我还没解决的问题是什么？">${h(note?.body??'')}</textarea></label><small>自动保存到浏览器；导出批注才能在其他设备恢复。</small></section>`}
  evidence(id){const related=this.controller.studyWorkbench.sessions.filter(s=>s.problemId===id||(mathKnowledgeById(id)&&mathProblemById(s.problemId)?.knowledgeIds.includes(id)));
    if(!related.length)return '暂无关联练习。可以从相关习题开始独立尝试。';const attempts=related.reduce((count,s)=>count+s.attempts.length,0);
    return `${related.length} 个关联学习会话 · ${attempts} 次正式尝试；这些只是学习记录，不能自动认定为掌握。`;
  }
  notFound(){$('#mathArchiveContent').innerHTML='<div class="math-archive-empty"><h2>没有找到这个档案</h2><p>链接可能来自较新的内容版本，请通过上方导航重新检索。</p></div>'}
}
