import {MathCollections,icon} from './math-library.js';
import {groupedConcepts} from './math-path.js';
import {semesterPredictions} from '../learning/semester-content.js';
import {KNOWLEDGE_FORMS,CONCEPT_FACETS,knowledgeClassification} from '../learning/math-content.js';
import {list,put} from '../../apps/web/db.js';
import {chapterItemId,MATH_CONTENT_VERSION,MATH_COURSES,MATH_KNOWLEDGE,MATH_METHODS,MATH_PROBLEMS,mathCourseById,mathKnowledgeById,mathMethodById,mathProblemById,mathProblemsForKnowledge,mathProblemsForMethod,searchMathContent} from '../learning/math-content.js';
import {appendInlineContent,renderStudyMarkdown} from './math-markup.js';
import {MATH_DISCOVERY_CASES,mathDiscoveryById} from '../learning/math-discovery.js';
import {renderDiscoveryPage,updateDiscoveryFigures,buildDiscoveryPacket} from './math-discovery.js';
import {RIGOR_SAMPLE_ID,RIGOR_NOTE_FIELDS,localRigorDate,rigorDailySubject,rigorDateFromSubject,validDailyRigorTasks} from '../learning/math-rigor.js';
import {RIGOR_PROOF,updateRigorDaily} from './math-rigor.js';

const $=selector=>document.querySelector(selector);
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const viewNames={courses:'课程',course:'课程',discovery:'例子与实验',problems:'题库',problem:'题库',knowledge:'知识库',methods:'方法库',method:'方法库',search:'全站数学检索',about:'关于'};
const masteryLabels=['未学习','初步理解','提示下完成','独立完成','可迁移运用'];
const annotationId=id=>`math-note:${id}`;
const archiveButton=(kind,id,title,detail='')=>`<button type="button" class="math-item-card" data-archive-kind="${h(kind)}" data-id="${h(id)}"><span class="math-item-title" data-math-inline="${h(title)}"></span><small>${h(detail)}</small><span class="math-item-arrow" aria-hidden="true">↗</span></button>`;
const renderInlineTitles=root=>{for(const item of root.querySelectorAll('[data-math-inline]')){item.replaceChildren();appendInlineContent(item,item.dataset.mathInline)}};
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export class MathArchive{
  constructor(controller){this.controller=controller;this.annotations=new Map();this.collections=new MathCollections();this.catalogFilters={};this.search={problems:'',knowledge:'',methods:'',search:''};this.filters={difficulty:'',type:''};this.timers=new Map();this.notice='';this.discoverySelectedId=RIGOR_SAMPLE_ID;this.rigorDate=null;}
  async load(){for(const note of await list('mathAnnotations'))this.annotations.set(note.id,note);this.bind()}
  bind(){const root=$('#mathArchive');root.addEventListener('click',event=>{
    const plot=event.target.closest('#discoveryPlotPrimary svg');
    if(plot){
      const matrix=plot.getScreenCTM();if(!matrix)return;
      const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
      const range=$('#discoveryX');
      range.value=Math.round(100*(point.x-Number(plot.dataset.plotLeft))/Number(plot.dataset.plotWidth));
      range.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    const button=event.target.closest('[data-archive-kind], [data-math-archive-action], [data-discovery-case], [data-discovery-action], [data-discovery-preset], #rigorDailyReset');if(!button)return;
    if(button.dataset.discoveryCase){this.controller.openMathArchive('discovery',button.dataset.discoveryCase);return}
    if(button.dataset.discoveryPreset){
      const range=$('#discoveryN');
      range.value=button.dataset.discoveryPreset;
      range.dispatchEvent(new Event('input',{bubbles:true}));
      return;
    }
    if(button.id==='rigorDailyReset'){
      this.saveRigorTasks([]);
      $('#rigorDailyDate').focus({preventScroll:true});
      return;
    }
    if(button.dataset.discoveryAction==='copy'){this.copyDiscoveryContext();return}
    if(button.dataset.archiveKind){this.controller.openMathArchive(button.dataset.archiveKind,button.dataset.id);return}
    const action=button.dataset.mathArchiveAction,id=button.dataset.id;
    if(action==='start')this.controller.studyWorkbench.startProblem(id);
    else if(action==='copy')this.copyProblem(id);
    else if(action==='home')this.controller.openMathArchive('courses');
    else if(action==='lab')this.controller.openAppliedHome();
    else if(action==='export')download('LMN-数学个人批注.json',{format:'lmn-math-annotations/1',contentVersion:MATH_CONTENT_VERSION,exportedAt:new Date().toISOString(),annotations:[...this.annotations.values()]});
    else if(action==='import')$('#mathAnnotationsImport')?.click();
    else if(action==='toolbox')this.controller.openMathToolbox();
  });
    root.addEventListener('submit',event=>{
      const form=event.target.closest('[data-collection-form]');if(!form)return;event.preventDefault();
      const action=event.submitter?.value||'save';
      const name=action==='remove'?form.elements.folder.value:form.elements.newFolder.value.trim()||form.elements.folder.value;
      try{
        this.collections.update(form.dataset.collectionForm,name,action);
        form.closest('details').outerHTML=this.collectionForm(form.dataset.collectionForm,name);
        $('#collectionControl').open=true;
        $('#collectionStatus').textContent=action==='remove'?'已从收藏夹移除。':'已存到「'+name+'」。';
        $('#collectionControl summary').focus({preventScroll:true});
      }catch(error){$('#collectionStatus').textContent=error.message}
    });
    root.addEventListener('input',event=>{
      if(event.target.id==='mathSearch'){const section=event.target.dataset.section;this.search[section]=event.target.value;this.renderListResults(section)}
      if(event.target.id==='mathPrivateNote'){this.updateAnnotation(event.target.dataset.id,{body:event.target.value})}
      if(event.target.matches('[data-discovery-note]'))this.updateAnnotation(this.discoverySelectedId,{[event.target.dataset.discoveryNote]:event.target.value});
      if(event.target.id==='discoveryN'){this.updateAnnotation(this.discoverySelectedId,{discoveryN:Number(event.target.value)});updateDiscoveryFigures(root)}
      if(event.target.id==='discoveryX'){this.updateAnnotation(this.discoverySelectedId,{discoveryX:Number(event.target.value)});updateDiscoveryFigures(root)}
    });
    root.addEventListener('change',event=>{
      if(event.target.matches('[data-catalog-filter]')){
        const {section,catalogFilter}=event.target.dataset;
        (this.catalogFilters[section]??={})[catalogFilter]=event.target.value;
        this.renderListResults(section);
      }
      if(event.target.id==='mathDifficulty'){this.filters.difficulty=event.target.value;this.renderListResults('problems')}
      if(event.target.id==='mathType'){this.filters.type=event.target.value;this.renderListResults('problems')}
      if(event.target.id==='mathMastery'){this.updateAnnotation(event.target.dataset.id,{mastery:event.target.value})}
      if(event.target.id==='mathAnnotationsImport')this.importAnnotations(event.target);
      if(event.target.id==='rigorDailyDate'){
        const date=rigorDateFromSubject(rigorDailySubject(event.target.value));
        this.rigorDate=date&&date!==localRigorDate()?date:null;
        event.target.value=this.rigorDate??localRigorDate();
        this.renderRigorTasks();
      }
      if(event.target.matches('[data-rigor-task]')){
        this.saveRigorTasks([...root.querySelectorAll('[data-rigor-task]:checked')].map(input=>input.dataset.rigorTask));
      }
      if(event.target.id==='discoveryDomain'){this.updateAnnotation(this.discoverySelectedId,{discoveryDomain:event.target.value});updateDiscoveryFigures(root)}
      if(event.target.id==='discoveryCompare'){this.updateAnnotation(this.discoverySelectedId,{discoveryCompareId:event.target.value});updateDiscoveryFigures(root)}
    });
  }
  updateAnnotation(id,patch,{immediate=false}={}){if(!this.validAnnotationTarget(id))return;const key=annotationId(id),old=this.annotations.get(key)??{id:key,subjectId:id,body:'',mastery:'未学习'};
    const next={...old,...patch,updatedAt:new Date().toISOString()};
    this.annotations.set(key,next);
    clearTimeout(this.timers.get(key));
    const save=()=>{this.timers.delete(key);put('mathAnnotations',next).catch(error=>this.showNotice(`批注保存失败：${error.message}`))};
    if(immediate)save();else this.timers.set(key,setTimeout(save,400));
    this.showNotice('私人批注已更新，将保存在当前浏览器中。');
  }
  validAnnotationTarget(id){return Boolean(mathKnowledgeById(id)||mathProblemById(id)||mathMethodById(id)||mathDiscoveryById(id)||rigorDateFromSubject(id))}
  renderRigorTasks(){
    const id=rigorDailySubject($('#rigorDailyDate').value);
    const tasks=this.annotations.get(annotationId(id))?.rigorTasks;
    updateRigorDaily($('#mathArchive'),validDailyRigorTasks(tasks)?tasks:[]);
  }
  saveRigorTasks(tasks){
    this.updateAnnotation(rigorDailySubject($('#rigorDailyDate').value),{rigorTasks:tasks},{immediate:true});
    this.renderRigorTasks();
  }
  async flushAnnotations(){
    const pending=[...this.timers.keys()].map(key=>this.annotations.get(key));
    for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();
    await Promise.all(pending.map(note=>put('mathAnnotations',note)));
  }
  showNotice(value){this.notice=value;const target=$('#mathArchiveStatus');if(target)target.textContent=value}
  async importAnnotations(input){const file=input.files?.[0];input.value='';if(!file)return;
    try{if(file.size>5*1024*1024)throw new Error('文件不能超过 5MB');const data=JSON.parse(await file.text());
      if(data?.format!=='lmn-math-annotations/1'||!Array.isArray(data.annotations)||data.annotations.length>20000)throw new Error('不是受支持的个人批注文件');
      const seen=new Set(),incoming=[];
      for(const item of data.annotations){
        if(!this.validImportedAnnotation(item)||seen.has(item.id))throw new Error('批注数据存在无效或重复记录');
        seen.add(item.id);
        incoming.push(item);
      }
      // Finish pending local saves before merging, so a debounce timer cannot undo the import.
      await this.flushAnnotations();
      let count=0;for(const item of incoming){const current=this.annotations.get(item.id);if(!current||String(item.updatedAt)>String(current.updatedAt)){await put('mathAnnotations',item);this.annotations.set(item.id,item);count++}}
      this.showNotice(`批注导入完成，更新 ${count} 条；本地较新的记录已保留。`);this.render();
    }catch(error){this.showNotice(`导入失败：${error.message}`)}
  }
  validImportedAnnotation(item){
    const boundedInteger=(value,min,max)=>value===undefined||(Number.isInteger(value)&&value>=min&&value<=max);
    if(!item||!this.validAnnotationTarget(item.subjectId)||item.id!==annotationId(item.subjectId))return false;
    if(typeof item.body!=='string'||item.body.length>100000||!masteryLabels.includes(item.mastery))return false;
    if(typeof item.updatedAt!=='string'||!Number.isFinite(Date.parse(item.updatedAt))||
      new Date(item.updatedAt).toISOString()!==item.updatedAt)return false;
    if(rigorDateFromSubject(item.subjectId))return validDailyRigorTasks(item.rigorTasks);
    if(item.rigorTasks!==undefined)return false;
    if(!boundedInteger(item.applicationN,1,64)||item.applicationB!==undefined&&![0.5,0.8,0.95,1].includes(item.applicationB))return false;
    if(item.applicationNote!==undefined&&(typeof item.applicationNote!=='string'||item.applicationNote.length>5000))return false;
    for(const field of Object.keys(RIGOR_NOTE_FIELDS)){
      if(item[field]!==undefined&&(typeof item[field]!=='string'||item[field].length>100000))return false;
    }
    return boundedInteger(item.discoveryN,1,32)&&boundedInteger(item.discoveryX,0,100)&&
      (item.discoveryDomain===undefined||['0:1','0:0.8','0.2:1'].includes(item.discoveryDomain))&&
      (item.discoveryCompareId===undefined||(mathDiscoveryById(item.discoveryCompareId)&&item.discoveryCompareId!==item.subjectId));
  }
  async copyProblem(id){const problem=mathProblemById(id);if(!problem)return;
    const text=`# ${problem.title}\n编号：${problem.id}\n\n${problem.prompt}\n\n关联知识：${problem.knowledgeIds.map(k=>mathKnowledgeById(k)?.title).join('、')}\n\n请作为数学学习教练，先给我最小提示，不要立即展示完整解答。`;
    try{await navigator.clipboard.writeText(text);this.showNotice('已复制题目和 AI 辅导请求（不包含答案）。')}catch{this.showNotice('浏览器禁止剪贴板操作，请进入解题工作台下载 AI 请求。')}
  }
  render(){const documentId=this.controller.document;if(!documentId.startsWith('math-archive:'))return;
    const [,view,id='']=documentId.split(':'),root=$('#mathArchive');if(!root)return;
    const rigor=view==='discovery'&&id===RIGOR_SAMPLE_ID;
    const title=rigor?'富有成果的严格性':viewNames[view]??'数学档案';
    root.innerHTML=`<div class="math-archive-shell"><header class="math-archive-page-head"><button type="button" class="math-archive-back" data-math-archive-action="home">← 课程目录</button><h1>${h(title)}</h1></header><div id="mathArchiveContent"></div><footer class="math-archive-footer"><button type="button" data-math-archive-action="export">导出我的全部批注 JSON</button><button type="button" data-math-archive-action="import">导入个人批注</button><input type="file" class="hidden" id="mathAnnotationsImport" accept=".json,application/json"><button type="button" data-math-archive-action="toolbox">打开知识工具箱</button><p id="mathArchiveStatus" role="status" aria-live="polite">${h(this.notice||'公开教材随网站版本更新；个人批注仅保存在本浏览器，请定期备份。')}</p></footer></div>`;
    if(view==='courses')this.renderCourses();else if(view==='course')this.renderCourse(id);else if(view==='discovery')this.renderDiscoveries(id);else if(view==='search'||view==='problems'||view==='knowledge'&&!id||view==='methods')this.renderList(view);else if(view==='problem')this.renderProblem(id);else if(view==='method')this.renderMethod(id);else if(view==='about')this.renderAbout();else this.renderKnowledge(id);
    if(id&&['discovery','knowledge','method','problem'].includes(view)){
      const route=this.controller.mathPath.forPage(view,id||this.discoverySelectedId);
      $('#mathArchiveContent').insertAdjacentHTML('afterbegin',route);
    }
    if(id&&['knowledge','method','problem'].includes(view)){
      $('.math-reading-main .math-reading-paper')?.insertAdjacentHTML('beforeend',this.collectionForm(id));
    }
    renderInlineTitles(root);
  }
  collectionForm(id,selected=''){
    const folders=this.collections.read();
    return `<details id="collectionControl" class="collection-control"><summary>${icon('folder')} 收藏与归类</summary>
      <form data-collection-form="${h(id)}">
        <label>已有收藏夹<select name="folder"><option value="">选择收藏夹</option>${folders.map(folder=>`<option value="${h(folder.name)}" ${selected===folder.name?'selected':''}>${h(folder.name)}${folder.items.includes(id)?'（已收藏）':''}</option>`).join('')}</select></label>
        <label>或新建收藏夹<input name="newFolder" maxlength="40" placeholder="例如：期中复习"></label>
        <div><button type="submit" value="save">保存到收藏夹</button> <button type="submit" value="remove">从所选收藏夹移除</button></div>
        <p id="collectionStatus" role="status"></p>
      </form></details>`;
  }
  renderCourses(){
    const catalog=(courses)=>courses.map(course=>`<button type="button" class="course-tile" data-archive-kind="course" data-id="${course.id}">${icon(course.icon||'book')}<span><b>${h(course.title)}</b><small>${h(course.semester?course.chapters.length+' 章 · '+course.chapters.reduce((n,c)=>n+c.knowledgeIds.length,0)+' 个知识单元':course.chapters[0].title)}</small></span><span aria-hidden="true">›</span></button>`).join('');
    $('#mathArchiveContent').innerHTML=`<h2 class="catalog-heading">本学期 · 课程教材</h2><div class="course-grid">${catalog(MATH_COURSES.filter(course=>course.semester))}</div><h2 class="catalog-heading">往期课程</h2><div class="course-grid">${catalog(MATH_COURSES.filter(course=>!course.semester))}</div>`;
  }
  renderCourse(id){
    const course=mathCourseById(id);if(!course){this.notFound();return}
    $('#mathArchiveContent').innerHTML=`<div class="course-heading">${icon(course.icon||'book')}<h2>${h(course.title)}</h2></div>${course.semester?`<nav class="math-surface" aria-label="章节目录"><h2>章节目录</h2><div class="chapter-directory">${course.chapters.map((chapter,i)=>`<a href="#${h(chapter.id)}" data-chapter-jump="${h(chapter.id)}">${i+1}. ${h(chapter.title)} · ${chapter.knowledgeIds.length} 单元</a>`).join('')}</div></nav>`:''}${course.chapters.map((chapter,index)=>{
      const readings=chapter.knowledgeIds.map(key=>mathKnowledgeById(chapterItemId(key)));
      const exercises=chapter.problemIds.map(key=>mathProblemById(chapterItemId(key)));
      const methods=MATH_METHODS.filter(method=>method.courseId===id&&method.knowledgeIds.some(key=>chapter.knowledgeIds.map(chapterItemId).includes(key)));
      const concepts=course.semester?readings.map(item=>archiveButton('knowledge',item.id,item.title,item.summary)).join(''):
        groupedConcepts(readings,(item,n)=>archiveButton('knowledge',item.id,item.title,n+' · '+item.kind));
      return `<details class="math-chapter-card" id="${h(chapter.id)}" ${index===0||!course.semester?'open':''}><summary class="math-chapter-head"><b>${index+1}. ${h(chapter.title)}</b><small>${readings.length} 知识 · ${exercises.length} 习题</small></summary><div class="chapter-directory">${concepts}</div>
        ${methods.length?`<details class="chapter-related"><summary>相关方法（${methods.length}）</summary><div class="chapter-directory">${methods.map(item=>archiveButton('method',item.id,item.title,item.trigger)).join('')}</div></details>`:''}
        <details class="chapter-related"><summary>相关习题（${exercises.length}）</summary><div class="chapter-directory">${exercises.map(item=>archiveButton('problem',item.id,item.title,item.id+' · '+item.type)).join('')}</div></details></details>`;
    }).join('')}`;
    for(const link of $('#mathArchiveContent').querySelectorAll('[data-chapter-jump]'))link.onclick=event=>{event.preventDefault();const chapter=document.getElementById(link.dataset.chapterJump);if(chapter){chapter.open=true;chapter.scrollIntoView({block:'start'});}};
  }
  catalogItems(section){
    return ({problems:MATH_PROBLEMS,knowledge:MATH_KNOWLEDGE,methods:MATH_METHODS})[section]??[...MATH_PROBLEMS,...MATH_KNOWLEDGE,...MATH_METHODS];
  }
  methodCategory(item){
    return item.category??({M01:'逻辑与定义',M02:'统一估计',M03:'反例构造',M04:'统一估计',M05:'收敛判别'})[item.id.slice(-3)];
  }
  renderList(section){
    const title={knowledge:'搜索知识',problems:'搜索题目',methods:'搜索方法',search:'搜索数学内容'}[section];
    const state=this.catalogFilters[section]??{};
    const select=(label,key,options)=>`<label>${label}<select data-section="${section}" data-catalog-filter="${key}"><option value="">全部</option>${options.map(([value,name])=>`<option value="${h(value)}" ${state[key]===value?'selected':''}>${h(name)}</option>`).join('')}</select></label>`;
    const courses=select('课程','course',MATH_COURSES.map(course=>[course.id,course.title]));
    const categories=section==='methods'?select('方法类型','category',[...new Set(MATH_METHODS.map(item=>this.methodCategory(item)))].map(name=>[name,name])):'';
    const classification=section==='knowledge'?select('知识主类','form',Object.entries(KNOWLEDGE_FORMS).map(([key,[label]])=>[key,label]))+select('概念特征','facet',Object.entries(CONCEPT_FACETS).map(([key,[label]])=>[key,label])):'';
    const folders=select('收藏夹','folder',this.collections.read().map(folder=>[folder.name,folder.name]));
    const problems=section==='problems'?`<label>难度<select id="mathDifficulty"><option value="">全部</option>${[1,2,3,4].map(level=>`<option value="${level}" ${this.filters.difficulty===String(level)?'selected':''}>${level}</option>`).join('')}</select></label><label>题型<select id="mathType"><option value="">全部</option>${[...new Set(MATH_PROBLEMS.map(p=>p.type))].map(type=>`<option value="${h(type)}" ${this.filters.type===type?'selected':''}>${h(type)}</option>`).join('')}</select></label>`:'';
    $('#mathArchiveContent').innerHTML=`<div class="catalog-search"><label>${title}<input type="search" id="mathSearch" data-section="${section}" value="${h(this.search[section]??'')}" placeholder="${section==='problems'?'题号（如 PROB-P01）、题名或关键词':'名称、关键词或编号'}"></label><div class="math-archive-filters">${courses}${classification}${categories}${problems}${folders}</div></div>${section==='knowledge'?'<div id="knowledgeClassExplanation" class="knowledge-class-explanation"></div>':''}<p id="mathArchiveCount" class="math-archive-count" role="status"></p><div id="mathArchiveResults" class="catalog-results"></div>`;
    this.renderListResults(section);
  }
  renderListResults(section){
    const root=$('#mathArchiveResults'),count=$('#mathArchiveCount');if(!root||!count)return;
    const items=this.catalogItems(section),state=this.catalogFilters[section]??{};
    const courseId=item=>item.courseId??'course-analysis-2';
    const folderItems=this.collections.read().find(folder=>folder.name===state.folder)?.items??[];
    const results=searchMathContent(items,{text:this.search[section],...(section==='problems'?this.filters:{})}).filter(item=>
      (!state.course||state.course===courseId(item))&&(!state.category||state.category===this.methodCategory(item))&&(!state.folder||folderItems.includes(item.id))&&(!state.form||knowledgeClassification(item)?.form===state.form)&&(!state.facet||knowledgeClassification(item)?.facets.includes(state.facet)));
    const explanation=$('#knowledgeClassExplanation');if(explanation){
      const info=[state.form?KNOWLEDGE_FORMS[state.form]:null,state.facet?CONCEPT_FACETS[state.facet]:null].filter(Boolean);
      explanation.innerHTML='<p>'+ (info.length?info.map(([label,description])=>'<b>'+h(label)+'</b>：'+h(description)).join('<br>'):'知识主类按单元的主要用途区分；概念特征描述其中数学对象的性质，可以重叠。课程只是另一种检索维度。')+'</p><details><summary>查看分类依据</summary><div class="class-reference">'+[...Object.values(KNOWLEDGE_FORMS),...Object.values(CONCEPT_FACETS)].map(([label,description])=>'<div><b>'+h(label)+'</b><span>'+h(description)+'</span></div>').join('')+'</div></details>';
    }
    count.textContent=`${results.length} / ${items.length} 个条目`;
    const rows=entries=>entries.map(item=>{
      const kind=item.prompt?'problem':item.body?'knowledge':'method';
      const cls=item.body?knowledgeClassification(item):null;
      const meta=cls?KNOWLEDGE_FORMS[cls.form][0]+' · '+cls.facets.map(key=>CONCEPT_FACETS[key][0]).join(' / '):item.prompt?item.type+' · 难度 '+item.difficulty:item.summary??item.trigger;
      return `<button type="button" class="math-item-card catalog-row" data-archive-kind="${kind}" data-id="${item.id}"><span class="catalog-id">${item.id}</span><span><strong data-math-inline="${h(item.title)}"></strong><small>${h(meta)}</small></span><span class="catalog-subject">${h(mathCourseById(courseId(item))?.title)}</span><span aria-hidden="true">›</span></button>`;
    }).join('');
    if(section==='knowledge')root.innerHTML=rows(results);
    else if(section==='methods')root.innerHTML=[...new Set(results.map(item=>this.methodCategory(item)))].map(category=>
      `<section><h2>${h(category)}</h2>${rows(results.filter(item=>this.methodCategory(item)===category))}</section>`).join('');
    else root.innerHTML=rows(results);
    if(!results.length)root.innerHTML='<p class="math-archive-empty">没有匹配条目。可以调整关键词或筛选条件。</p>';
    renderInlineTitles(root);
  }
  renderKnowledge(id){const knowledge=mathKnowledgeById(id);if(!knowledge){this.notFound();return}const related=mathProblemsForKnowledge(id),classification=knowledgeClassification(knowledge);
    $('#mathArchiveContent').innerHTML=`<article class="math-reading-layout"><div class="math-reading-main"><div class="math-reading-paper"><span class="math-kicker">知识档案 · ${h(knowledge.id)} · ${h(classification?KNOWLEDGE_FORMS[classification.form][0]:knowledge.kind)}</span><h2>${h(knowledge.title)}</h2><p class="math-reading-summary">${h(knowledge.summary)}${classification?`<span class="knowledge-facets">${classification.facets.map(key=>`<span>${h(CONCEPT_FACETS[key][0])}</span>`).join('')}</span>`:''}</p><div class="math-reading-body" id="mathReadingBody"></div></div><section class="math-reading-paper"><h3>关联习题</h3><div class="math-compact-grid">${related.map(item=>archiveButton('problem',item.id,item.title,`难度 ${item.difficulty} · ${item.type}`)).join('')}</div></section></div><aside class="math-reading-side"><section class="math-reading-paper"><h3>前置知识</h3>${knowledge.prerequisites.length?knowledge.prerequisites.map(x=>archiveButton('knowledge',x,mathKnowledgeById(x)?.title??x)).join(''):'<p>本专题的基础入口。</p>'}<h3>学习证据</h3><p>${h(this.evidence(knowledge.id))}</p></section>${this.annotationSection(knowledge.id)}</aside></article>`;
    renderStudyMarkdown($('#mathReadingBody'),knowledge.body);
    const prediction=semesterPredictions[id];
    if(prediction){
      const [question,options,correct,explanation]=prediction;
      const form=document.createElement('form');
      form.className='discovery-check';
      form.innerHTML='<h3>先做一个预测</h3><fieldset><legend>'+h(question)+'</legend>'+options.map((option,i)=>'<label><input type="radio" name="prediction" value="'+i+'" required>'+h(option)+'</label>').join('')+'</fieldset><button class="primary" type="submit">检验我的判断</button><p role="status" aria-live="polite"></p>';
      form.onsubmit=event=>{
        event.preventDefault();
        const value=form.elements.prediction.value;
        if(value==='')return;
        form.querySelector('[role=status]').textContent=(Number(value)===correct?'判断正确。':'这个判断需要修正。')+explanation+' 接着阅读下面的算例，并用关联习题独立验证。';
      };
      $('#mathReadingBody').before(form);
    }
    const reflection=this.annotations.get(annotationId(id))?.applicationNote;
    if(reflection){const section=document.createElement('section');section.className='math-reading-paper';
      const title=document.createElement('h3');title.textContent='我在应用实验中的解释';
      const note=document.createElement('p');note.textContent=reflection;section.append(title,note);$('#mathArchiveContent .math-reading-main').append(section)}
  }
  renderProblem(id){const problem=mathProblemById(id);if(!problem){this.notFound();return}
    $('#mathArchiveContent').innerHTML=`<article class="math-reading-layout"><div class="math-reading-main"><div class="math-reading-paper"><span class="math-kicker">习题档案 · ${h(problem.id)} · 难度 ${problem.difficulty}</span><h2>${h(problem.title)}</h2><p class="math-reading-summary">${h(problem.type)} · ${h(mathCourseById(problem.courseId)?.title)}</p><div class="math-reading-body" id="mathReadingBody"></div><div class="math-problem-actions"><button type="button" class="primary" data-math-archive-action="start" data-id="${h(problem.id)}">开始独立解题 →</button><button type="button" data-math-archive-action="copy" data-id="${h(problem.id)}">复制题目给 AI</button></div></div><section class="math-reading-paper"><h3>分层提示</h3><p>解题工作台会在你提交首次尝试后逐步解锁提示。这里的参考解答默认折叠。</p><details class="math-optional-solution"><summary>查看题目提示与参考解答</summary><div id="mathReadingHints"></div><h4>参考解答</h4><div id="mathReadingSolution"></div></details></section><section class="math-reading-paper"><h3>迁移训练</h3><div id="mathReadingTransfer" class="math-reading-body"></div></section></div><aside class="math-reading-side"><section class="math-reading-paper"><h3>解题需要哪些知识？</h3>${problem.knowledgeIds.map(x=>archiveButton('knowledge',x,mathKnowledgeById(x)?.title??x)).join('')}<h3>可能使用的方法</h3>${problem.methodIds.map(x=>archiveButton('method',x,mathMethodById(x)?.title??x)).join('')}<h3>我的学习证据</h3><p>${h(this.evidence(problem.id))}</p></section>${this.annotationSection(problem.id)}</aside></article>`;
    renderStudyMarkdown($('#mathReadingBody'),problem.prompt);renderStudyMarkdown($('#mathReadingHints'),problem.hints.map((hint,i)=>`${i+1}. ${hint}`).join('\n'));renderStudyMarkdown($('#mathReadingSolution'),problem.solution);renderStudyMarkdown($('#mathReadingTransfer'),problem.transfer);const title=$('#mathArchiveContent h2');title.replaceChildren();appendInlineContent(title,problem.title);
  }
  renderMethod(id){const method=mathMethodById(id);if(!method){this.notFound();return}
    $('#mathArchiveContent').innerHTML=`<article class="math-reading-layout"><div class="math-reading-main"><div class="math-reading-paper"><span class="math-kicker">方法档案 · ${h(id)}</span><h2>${h(method.title)}</h2><dl class="math-method-definition"><dt>触发条件</dt><dd id="mathMethodTrigger"></dd><dt>核心动作</dt><dd id="mathMethodAction"></dd><dt>有效原因</dt><dd id="mathMethodReason"></dd><dt>适用边界</dt><dd id="mathMethodBoundary"></dd></dl></div><section class="math-reading-paper"><h3>使用此方法的习题</h3><div class="math-compact-grid">${mathProblemsForMethod(id).map(item=>archiveButton('problem',item.id,item.title,`难度 ${item.difficulty}`)).join('')}</div></section></div><aside class="math-reading-side"><section class="math-reading-paper"><h3>相关知识</h3>${method.knowledgeIds.map(x=>archiveButton('knowledge',x,mathKnowledgeById(x)?.title??x)).join('')}</section>${this.annotationSection(id)}</aside></article>`;
    for(const [selector,text]of [['#mathMethodTrigger',method.trigger],['#mathMethodAction',method.action],['#mathMethodReason',method.reason],['#mathMethodBoundary',method.boundary]])renderStudyMarkdown($(selector),text);
  }
  renderDiscoveries(id=''){
    if(!id){
      const root=$('#mathArchiveContent');
      const worked=MATH_KNOWLEDGE.filter(item=>item.example&&item.id.endsWith('K01'));
      root.innerHTML=`<h2 class="catalog-heading">按课程看算例</h2><div class="course-grid">${worked.map(item=>{
        const course=mathCourseById(item.courseId);
        return `<button type="button" class="course-tile" data-archive-kind="knowledge" data-id="${item.id}">${icon(course.icon)}<span><b>${h(item.title)}</b><small>${h(course.title)}</small></span><span aria-hidden="true">›</span></button>`;
      }).join('')}</div><div class="experiment-heading"><h2 class="catalog-heading">交互实验 · 函数列</h2><button type="button" data-math-archive-action="lab">打开计算与结构工具</button></div><div class="course-grid">${MATH_DISCOVERY_CASES.map(item=>
        `<button type="button" class="course-tile math-discovery-sample" data-discovery-case="${item.id}">${icon('curve')}<span><b>${h(item.title)}</b><small>${h(item.expression)}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>`;
      return;
    }
    const selected=mathDiscoveryById(id);
    if(!selected){this.notFound();return}
    this.discoverySelectedId=selected.id;
    const savedNote=this.annotations.get(annotationId(selected.id));
    const savedCompare=savedNote?.discoveryCompareId;
    const defaultCompare=selected.id===RIGOR_SAMPLE_ID?'SEQ-LINEAR':selected.id==='SEQ-SPIKE'?'SEQ-POWER':'SEQ-SPIKE';
    const compare=mathDiscoveryById(savedCompare)&&savedCompare!==selected.id?savedCompare:defaultCompare;
    $('#mathArchiveContent').innerHTML=renderDiscoveryPage({selectedId:selected.id,compareId:compare,annotations:this.annotations,rigorDate:this.rigorDate??localRigorDate()});
    const formula=$('#discoveryFormula');if(formula)renderStudyMarkdown(formula,'$'+selected.latex+'$');
    const prompt=$('#discoveryPrompt');if(prompt)renderStudyMarkdown(prompt,selected.observationPrompt);
    const hint=$('#discoveryPointwiseHint');if(hint)renderStudyMarkdown(hint,selected.pointwiseHint);
    if(selected.id===RIGOR_SAMPLE_ID){
      renderStudyMarkdown($('#rigorProof'),RIGOR_PROOF);
      this.renderRigorTasks();
    }
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
