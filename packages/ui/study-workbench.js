import {list,put} from '../../apps/web/db.js';
import {acceptStudyFeedback,changeStudyTask,createStudySession,dueStudySessions,exportStudyArchive,finishStudySession,mergeStudySessions,parseStudyFeedback,recordStudyReview,revealStudyHint,STUDY_TASKS,studyContextPacket,submitStudyAttempt,UNIFORM_N_LESSON,updateStudyDraft,validateStudyArchive} from '../learning/study-session.js';
import {appendInlineContent,renderStudyMarkdown} from './math-markup.js';
import {mathKnowledgeById,mathProblemById} from '../learning/math-content.js';

const $=selector=>document.querySelector(selector);
const html=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const day=value=>value?new Date(value).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}):'';
const taskName={main:'自主理解',transfer:'迁移练习',review:'延迟回忆'};
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function message(text){const element=$('#studyStatus');if(element)element.textContent=text}

export class StudyWorkbench {
  constructor(controller){this.controller=controller;this.sessions=[];this.feedbackInput=new Map();this.feedbackPreview=new Map();this.archivePreview=null;this.draftTimers=new Map();this.saving=Promise.resolve();}
  async load(){this.sessions=await list('studySessions');this.bind()}
  current(){const id=this.controller.document.startsWith('study-workbench:')?this.controller.document.slice('study-workbench:'.length):null;return this.sessions.find(item=>item.id===id)}
  persist(session,{immediate=true}={}){
    const index=this.sessions.findIndex(item=>item.id===session.id);
    if(index<0)this.sessions.unshift(session);else this.sessions[index]=session;
    clearTimeout(this.draftTimers.get(session.id));
    this.draftTimers.delete(session.id);
    if(immediate)this.save(session);else this.draftTimers.set(session.id,setTimeout(()=>{this.draftTimers.delete(session.id);this.save(this.sessions.find(item=>item.id===session.id))},350));
  }
  save(session){if(!session)return;const snapshot=structuredClone(session);this.saving=this.saving.catch(()=>{}).then(()=>put('studySessions',snapshot)).catch(error=>message(`保存失败：${error.message}。请先导出学习档案。`))}
  bind(){
    const root=$('#studyWorkbenchBody');
    root.addEventListener('input',event=>{
      const session=this.current();if(!session)return;
      if(event.target.id==='studyDraft'){this.persist(updateStudyDraft(session,event.target.value),{immediate:false});message('草稿将自动保存在本浏览器');}
      if(event.target.id==='studyFeedbackInput'){
        this.feedbackInput.set(session.id,event.target.value);this.feedbackPreview.delete(session.id);
        const button=root.querySelector('[data-study-action="accept-feedback"]');if(button)button.disabled=true;
        const preview=root.querySelector('#studyFeedbackPreview');if(preview)preview.textContent='反馈内容已变更，请重新验证后再收录。';
      }
      if(event.target.id==='studyRecap'){this.persist({...session,recap:event.target.value,updatedAt:new Date().toISOString()},{immediate:false})}
    });
    root.addEventListener('change',event=>{
      if(event.target.matches('[data-study-check]')){const session=this.current();this.persist({...session,selfChecks:{...session.selfChecks,[event.target.dataset.studyCheck]:event.target.checked},updatedAt:new Date().toISOString()})}
    });
    root.addEventListener('click',event=>{
      const button=event.target.closest('[data-study-action]');if(!button)return;
      this.action(button.dataset.studyAction,button.dataset.value).catch(error=>message(error.message));
    });
    $('#studySessionsExport').onclick=()=>download('LMN-学习档案.json',exportStudyArchive(this.sessions));
    $('#studySessionsImport').onchange=async event=>{
      this.archivePreview=null;const file=event.target.files?.[0];if(!file)return;
      try{if(file.size>15*1024*1024)throw new Error('档案超过 15MB，请分批处理');const sessions=validateStudyArchive(await file.text());this.archivePreview=sessions;
        const newCount=sessions.filter(item=>!this.sessions.some(old=>old.id===item.id)).length;
        $('#studyArchivePreview').textContent=`已校验 ${sessions.length} 个会话，其中 ${newCount} 个是新增记录。其余同 ID 会话仅在导入数据更新时间较晚时更新；不会清空已有记录。`;
        $('#studyArchiveCommit').disabled=false;
      }catch(error){$('#studyArchivePreview').textContent=`无法导入：${error.message}`;$('#studyArchiveCommit').disabled=true}finally{event.target.value=''}
    };
    $('#studyArchiveCommit').onclick=async()=>{
      if(!this.archivePreview)return;
      $('#studyArchiveCommit').disabled=true;
      $('#studyArchivePreview').textContent='正在合并学习档案，请稍候…';
      try{
        for(const timeout of this.draftTimers.values())clearTimeout(timeout);this.draftTimers.clear();await this.saving;
        const merged=mergeStudySessions(this.sessions,this.archivePreview);await Promise.all(merged.map(item=>put('studySessions',item)));
        this.sessions=merged;this.archivePreview=null;$('#studyArchivePreview').textContent='导入完成。原有知识库与 LKL3 数据没有被修改。';this.renderHome();
      }catch(error){$('#studyArchivePreview').textContent=`保存失败：${error.message}。请检查浏览器存储后重试。`;$('#studyArchiveCommit').disabled=false}
    };
  }
  start(title,mode,chapterId){const session=createStudySession({title,mode,chapterId});this.persist(session);this.open(session.id)}
  startProblem(problemId){const problem=mathProblemById(problemId);if(!problem)throw new Error('无法找到该题目');
    const existing=this.sessions.find(session=>session.problemId===problemId&&session.status==='active');
    if(existing){this.open(existing.id);return existing}
    const session=createStudySession({title:problem.title,mode:'problem',problemId:problem.id});this.persist(session);this.open(session.id);return session;
  }
  open(id){const session=this.sessions.find(item=>item.id===id);if(!session)return;
    const c=this.controller;c.closeTransientOverlays();c.closePanel();c.currentKnowledgeId=null;c.currentInstanceId=null;c.currentBoardId=null;
    c.document=`study-workbench:${session.id}`;c.path=[{kind:'document',id:c.document,label:'学习 · '+session.title,document:c.document}];c.rememberDocument(null,c.document);c.pushLocation();c.renderAll();
  }
  renderHome(){const root=$('#studySessionsHome');if(!root)return;root.replaceChildren();
    const due=dueStudySessions(this.sessions),recent=[...this.sessions].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,6);
    if(!recent.length){root.innerHTML='<p class="study-empty">还没有学习会话。从上方输入一个数学问题，即可开始独立尝试。</p>';return}
    const title=document.createElement('p');title.className='study-session-home-summary';title.textContent=`${due.length} 项待复习 · ${this.sessions.length} 个学习会话`;root.append(title);
    for(const session of [...due,...recent.filter(item=>!due.includes(item))].slice(0,8)){
      const button=document.createElement('button');button.type='button';button.className='learning-recent-row';
      const name=document.createElement('span');name.textContent=session.title;
      const meta=document.createElement('small');meta.textContent=due.includes(session)?`到期复习 · ${day(session.dueAt)}`:session.status==='review'?`下次复习 ${day(session.dueAt)}`:`${session.attempts.length} 次尝试 · 继续`;
      button.append(name,meta);button.onclick=()=>this.open(session.id);root.append(button);
    }
  }
  render(){const session=this.current(),root=$('#studyWorkbenchBody');if(!session||!root)return;
    const problem=mathProblemById(session.problemId);
    const lesson=session.lessonKey==='uniform-n'?UNIFORM_N_LESSON:null;
    const guidedHints=problem?.hints??lesson?.hints??[];
    const task=session.task,ownAttempts=session.attempts.filter(item=>item.task===task),hints=session.hints.filter(item=>item.task===task),feedback=session.feedback.filter(item=>item.attemptId===ownAttempts.at(-1)?.id);
    const taskPrompt=problem?(task==='main'?problem.prompt:task==='transfer'?problem.transfer:`不看答案，重新独立完成：${problem.prompt}`):lesson?.[task]??(task==='main'?`独立说明或解决这个问题：${session.title}`:task==='transfer'?'请改变一个条件，自己构造新的例子并验证结论。':'不看笔记复述核心定义、思路及适用边界。');
    const feedbackText=this.feedbackInput.get(session.id)??'',preview=this.feedbackPreview.get(session.id);
    root.innerHTML=`
      <header class="study-workbench-header"><div><p class="eyebrow">${problem?`题库 · ${html(problem.id)} · ${html(problem.type)}`:`学习会话 · ${html(session.mode)}`}</p><h1>${html(session.title)}</h1><p>先独立思考 → 最小提示与反馈 → 重新尝试 → 迁移与复习。每次提交都会留下可检验的原始记录。</p></div><button type="button" data-study-action="${problem?'problem':'home'}" ${problem?`data-value="${html(problem.id)}"`:''}>${problem?'返回题目档案':'返回学习首页'}</button></header>
      <nav class="study-workbench-steps" aria-label="学习阶段"><button type="button" class="${task==='main'?'active':''}" data-study-action="stage" data-value="main">1 · 自主理解</button><button type="button" class="${task==='transfer'?'active':''}" data-study-action="stage" data-value="transfer" ${session.attempts.some(item=>item.task==='main')?'':'disabled'}>2 · 迁移检验</button><button type="button" class="${task==='review'?'active':''}" data-study-action="stage" data-value="review" ${session.status==='review'?'':'disabled'}>3 · 延迟回忆</button></nav>
      <div class="study-workbench-grid"><section class="study-task-panel"><h2>本轮任务 · ${taskName[task]}</h2><div class="study-question" id="studyQuestion"></div>
        <section class="study-definition"><h3>${problem?'相关知识 · 可随时查阅':'学习目标'}</h3>${problem?problem.knowledgeIds.map(id=>`<button type="button" class="study-knowledge-link" data-study-action="knowledge" data-value="${html(id)}">${html(mathKnowledgeById(id)?.title??id)} ↗</button>`).join(''):lesson?'辨认量词差异 → 用一个序列反驳错误直觉 → 迁移到收敛成立的情形':'以定义、例子与独立推理建立可检验的理解。'}</section>
        <section class="study-evidence"><h3>理解证据（由你标记，非 AI 评分）</h3>
          ${[['definition','能准确叙述相关定义'],['counterexample','能解释一个反例或边界'],['independent','能不看提示独立推导'],['transfer','能迁移到变化后的条件']].map(([key,label])=>`<label><input type="checkbox" data-study-check="${key}" ${session.selfChecks?.[key]?'checked':''}>${label}</label>`).join('')}
        </section>
        <details class="study-records"><summary>历史尝试（${session.attempts.length} 条）与 AI 反馈（${session.feedback.length} 条）</summary>${session.attempts.map((a,index)=>`<article><h4>第 ${index+1} 次 · ${taskName[a.task]} · ${day(a.createdAt)} · 使用提示 ${a.hintCount} 次</h4><pre>${html(a.content)}</pre>${session.feedback.filter(f=>f.attemptId===a.id).map(f=>`<div class="study-record-feedback"><b>导入的反馈</b><p>${html(f.summary)}</p><p>下一步：${html(f.nextAction)}</p></div>`).join('')}</article>`).join('')||'<p>尚无尝试。</p>'}</details>
      </section><div class="study-practice-column"><section class="study-writing-panel"><header><div><h2>先写下自己的想法</h2><small>支持 Markdown 与 LaTeX（如 $\\forall x$）；草稿自动保存</small></div><span>${ownAttempts.length} 次已提交</span></header>
          <label for="studyDraft">草稿 / 证明 / 反例</label><textarea id="studyDraft" rows="10" placeholder="先用自己的话解释。哪里不确定，也请明确写出……">${html(session.draft)}</textarea>
          <div class="study-actions"><button type="button" class="primary" data-study-action="submit">保存本轮独立尝试</button><button type="button" data-study-action="preview">预览公式与正文</button></div><div class="study-draft-preview hidden" id="studyDraftPreview"></div></section>
        <section class="study-hint-panel"><header><div><h2>逐层提示</h2><p>先提交一次自己的尝试，才会解锁提示。提示使用次数会保留。</p></div><button type="button" data-study-action="hint" ${!guidedHints.length||task!=='main'||!ownAttempts.length||hints.length>=guidedHints.length?'disabled':''}>${!guidedHints.length?'本题暂无内置提示':hints.length===guidedHints.length?'提示已全部展示':`查看第 ${hints.length+1} 层提示`}</button></header><div id="studyHints"></div></section>
        ${problem?`<section class="study-solution-panel"><h2>参考解答与自我校验</h2>${session.attempts.length?`<details><summary>展开经过校核的参考解答</summary><div id="studySolution"></div></details>`:'<p>请先保存至少一次独立尝试，然后才能查看完整参考解答。</p>'}<p>参考解答是对照材料，不等于你的独立掌握程度。</p></section>`:''}
        <section class="study-ai-panel"><header><div><h2>AI 辅导 · 导出与导入</h2><p>网站尚未连接在线模型。将上下文交给 AI，再把反馈 JSON 粘贴回来；只有确认后才入档。</p></div></header>
          <div class="study-actions"><button type="button" data-study-action="copy-context">复制本轮 AI 请求</button><button type="button" data-study-action="download-context">下载请求 JSON</button></div>
          <details><summary>查看完整 AI 请求</summary><textarea aria-label="AI 请求 JSON" readonly rows="8" id="studyContextJson"></textarea></details>
          <label for="studyFeedbackInput">粘贴 AI 返回的反馈 JSON</label><textarea id="studyFeedbackInput" rows="5" placeholder='{"format":"lmn-study-feedback/1", ...}'>${html(feedbackText)}</textarea>
          <div class="study-actions"><button type="button" data-study-action="preview-feedback">验证反馈</button><button type="button" class="primary" data-study-action="accept-feedback" ${preview?'':'disabled'}>确认收录反馈</button></div>
          <div id="studyFeedbackPreview" class="study-feedback-preview" aria-live="polite">${preview?`<b>已校验，尚未保存</b><p>${html(preview.summary)}</p><p>下一步：${html(preview.nextAction)}</p>`:'反馈须关联本会话及一次已提交的尝试。'}</div>
          ${feedback.map(item=>`<div class="study-record-feedback"><b>已收录：${html(item.summary)}</b><p>问题：${html(item.issues.join('；')||'未列出')}</p><p>下一步：${html(item.nextAction)}</p></div>`).join('')}
        </section>
        <section class="study-finish-panel"><h2>收束与下一步</h2><label for="studyRecap">用一句话总结你目前真正弄清了什么</label><textarea id="studyRecap" rows="3">${html(session.recap??'')}</textarea>
          <div class="study-actions"><button type="button" data-study-action="stage" data-value="transfer" ${session.attempts.some(item=>item.task==='main')?'':'disabled'}>开始迁移检验</button><button type="button" data-study-action="finish" ${session.attempts.some(item=>item.task==='main')?'':'disabled'}>${session.status==='review'?'重新安排明日复习':'结束本次学习，安排明日复习'}</button><button type="button" data-study-action="notes">将学习成果整理为知识笔记</button></div>
          ${session.status==='review'?`<p>下次复习：${html(day(session.dueAt))}。不看提示提交一份回忆尝试后，再选择本轮回忆结果。</p><div class="study-actions"><button type="button" data-study-action="review" data-value="yes" ${session.attempts.filter(a=>a.task==='review').length>session.reviews.length?'':'disabled'}>独立回忆成功</button><button type="button" data-study-action="review" data-value="no" ${session.attempts.filter(a=>a.task==='review').length>session.reviews.length?'':'disabled'}>仍需补足</button></div>`:''}
        </section></div></div>`;
    const heading=root.querySelector('.study-workbench-header h1');heading.replaceChildren();appendInlineContent(heading,session.title);
    renderStudyMarkdown($('#studyQuestion'),taskPrompt);
    for(const hint of hints){const box=document.createElement('div');box.className='study-hint';const heading=document.createElement('strong');heading.textContent=`第 ${hint.level} 层提示`;box.append(heading);const body=document.createElement('div');renderStudyMarkdown(body,guidedHints[hint.level-1]??'');box.append(body);$('#studyHints').append(box)}
    if(problem&&session.attempts.length)renderStudyMarkdown($('#studySolution'),problem.solution);
    $('#studyContextJson').value=JSON.stringify(studyContextPacket(session),null,2);
  }
  async action(action,value){const session=this.current();if(action==='home'){this.controller.activateHome();return}if(action==='problem'){this.controller.openMathArchive('problem',value);return}if(action==='knowledge'){this.controller.openMathArchive('knowledge',value);return}if(!session)return;
    if(action==='submit'){this.persist(submitStudyAttempt(session));this.feedbackPreview.delete(session.id);message('独立尝试已保存，可以继续思考或请求提示。')}
    else if(action==='hint'){this.persist(revealStudyHint(session));message('已记录这次提示使用。')}
    else if(action==='stage'){this.persist(changeStudyTask(session,value))}
    else if(action==='finish'){this.persist(finishStudySession(session));message('已安排明日复习。')}
    else if(action==='review'){this.persist(recordStudyReview(session,{remembered:value==='yes'}));message('本轮复习已记录，下一次到期日已更新。')}
    else if(action==='copy-context'){const content=JSON.stringify(studyContextPacket(session),null,2);try{await navigator.clipboard.writeText(content);message('AI 请求已复制。可粘贴到 ChatGPT，要求返回约定的反馈 JSON。')}catch{const field=$('#studyContextJson');field.closest('details').open=true;field.select();message('浏览器未允许复制；请手动复制已选中的请求文本。')}return}
    else if(action==='download-context'){download('LMN-AI-学习请求.json',JSON.stringify(studyContextPacket(session),null,2));return}
    else if(action==='preview'){const panel=$('#studyDraftPreview');panel.classList.remove('hidden');renderStudyMarkdown(panel,session.draft||'*尚未书写*');return}
    else if(action==='preview-feedback'){const result=parseStudyFeedback(this.feedbackInput.get(session.id)??'',session);this.feedbackPreview.set(session.id,result);message(`已校验：关联尝试 ${result.attemptId}，确认后才保存。`)}
    else if(action==='accept-feedback'){const feedback=this.feedbackPreview.get(session.id);if(!feedback)throw new Error('先验证反馈');this.persist(acceptStudyFeedback(session,feedback));this.feedbackPreview.delete(session.id);this.feedbackInput.delete(session.id);message('AI 反馈已收录，并与原始尝试关联。')}
    else if(action==='notes'){
      const existing=session.knowledgeId&&this.controller.state.knowledge.some(item=>item.id===session.knowledgeId);
      if(existing){this.controller.openKnowledge(session.knowledgeId);return}
      const body=`# ${session.title}\n\n## 目前的理解\n${session.recap||'待整理'}\n\n## 独立尝试\n${session.attempts.map((a,i)=>`### 第 ${i+1} 次 · ${taskName[a.task]}\n${a.content}`).join('\n\n')||'待补充'}\n\n## 待解决的问题\n${session.feedback.flatMap(f=>f.issues).join('\n- ')||'待进一步验证'}`;
      const knowledge=this.controller.createKnowledge(session.title,{initialContent:body,studyKind:session.chapterId?'unit':null,parentKnowledgeId:session.chapterId});
      this.persist({...session,knowledgeId:knowledge.id,updatedAt:new Date().toISOString()});return;
    }
    this.render();
  }
}
