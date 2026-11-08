// A learning session records evidence of practice, not a knowledge or LKL object.
export const STUDY_ARCHIVE_FORMAT='lmn-study-sessions/1';
export const FEEDBACK_FORMAT='lmn-study-feedback/1';
export const UNIFORM_N='uniform-n';
export const STUDY_TASKS=Object.freeze(['main','transfer','review']);
export const UNIFORM_N_LESSON=Object.freeze({
  question:'一致收敛为何要求统一的 N？',
  main:'请从逐点收敛与一致收敛的量词顺序出发，说明「统一的 N」究竟统一了什么。再用 $f_n(x)=x^n$ 在 $[0,1)$ 上的表现构造反例。不要只背定义，请解释为什么反例成立。',
  transfer:'迁移检验：若定义域改为 $[0,a]$，其中 $0<a<1$，$x^n$ 是否一致收敛到 $0$？请独立给出对所有 $x$ 都有效的 $N(\\varepsilon)$。',
  review:'不看笔记，复述逐点与一致收敛的量词差异，并重新说明 $x^n$ 在 $[0,1)$ 上为什么不一致收敛。',
  hints:Object.freeze([
    '先写出两个量词顺序：逐点收敛中的 $N$ 可以依赖 $x$；一致收敛要求先选定 $N$，再面对定义域中的所有 $x$。为什么这两句话不等价？',
    '观察 $f_n(x)=x^n$。对固定 $x<1$，它趋于 $0$；但允许 $x$ 随 $n$ 接近 $1$ 时，误差是否也同时趋于 $0$？',
    '对每个 $n$ 取 $x_n=2^{-1/n}$。检查 $x_n\\in[0,1)$ 与 $x_n^n=1/2$。它否定的是一致收敛定义里的哪一个量词？',
    '完整核查：逐点收敛成立；若取 $\\varepsilon=1/2$，任何 $N$ 都可选择 $n\\ge N$ 和 $x_n=2^{-1/n}$，使 $|f_n(x_n)|=1/2$ 不满足严格小于号。这里 $\\sup_{x\\in[0,1)}x^n=1$，但最大值不取到。'
  ])
});

const timestamp=()=>new Date().toISOString();
const newId=()=>globalThis.crypto?.randomUUID?.()??`study-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const uniqueIds=items=>new Set(items.map(item=>item.id)).size===items.length;
export const isUniformNTopic=title=>/一致收敛|uniform convergence/i.test(title)&&/(统一|N|量词|uniform)/i.test(title);

export function createStudySession({title,mode='concept',chapterId=null,now=timestamp(),id=newId()}={}){
  if(!nonempty(title)||title.trim().length>120)throw new Error('学习问题应为 1–120 个字符');
  return {id,title:title.trim(),mode,chapterId,lessonKey:isUniformNTopic(title)?UNIFORM_N:null,
    task:'main',draft:'',drafts:{main:'',transfer:'',review:''},attempts:[],hints:[],feedback:[],reviews:[],selfChecks:{},recap:'',
    status:'active',dueAt:null,createdAt:now,updatedAt:now};
}

export function submitStudyAttempt(session,{now=timestamp(),id=newId()}={}){
  if(!nonempty(session.draft))throw new Error('请先写下自己的尝试，再提交这一轮');
  if(!STUDY_TASKS.includes(session.task))throw new Error('未知学习任务');
  const attempt={id,task:session.task,content:session.draft.trim(),hintCount:session.hints.filter(hint=>hint.task===session.task).length,createdAt:now};
  return {...session,attempts:[...session.attempts,attempt],draft:'',drafts:{...session.drafts,[session.task]:''},updatedAt:now};
}

export function updateStudyDraft(session,draft,{now=timestamp()}={}){
  return {...session,draft,drafts:{...session.drafts,[session.task]:draft},updatedAt:now};
}

export function revealStudyHint(session,{now=timestamp()}={}){
  if(session.lessonKey!==UNIFORM_N||session.task!=='main')throw new Error('当前问题没有预设的分层提示，可导出问题请 AI 提示');
  if(!session.attempts.some(attempt=>attempt.task===session.task))throw new Error('先保存至少一次独立尝试，再查看提示');
  const level=session.hints.filter(hint=>hint.task===session.task).length+1;
  if(level>UNIFORM_N_LESSON.hints.length)throw new Error('全部提示已经显示');
  return {...session,hints:[...session.hints,{task:session.task,level,createdAt:now}],updatedAt:now};
}

export function changeStudyTask(session,task,{now=timestamp()}={}){
  if(!STUDY_TASKS.includes(task))throw new Error('未知学习任务');
  if(task==='transfer'&&!session.attempts.some(attempt=>attempt.task==='main'))throw new Error('完成一次初始尝试后才能进入迁移任务');
  if(task==='review'&&session.status!=='review')throw new Error('需先安排复习');
  return {...session,task,draft:session.drafts?.[task]??'',updatedAt:now};
}

export function finishStudySession(session,{now=timestamp()}={}){
  if(!session.attempts.some(attempt=>attempt.task==='main'))throw new Error('至少提交一次独立尝试才能安排复习');
  const dueAt=new Date(Date.parse(now)+24*60*60*1000).toISOString();
  return {...session,status:'review',task:'review',draft:session.drafts?.review??'',dueAt,updatedAt:now};
}

export function recordStudyReview(session,{now=timestamp(),remembered=false,id=newId()}={}){
  if(session.status!=='review'||session.attempts.filter(attempt=>attempt.task==='review').length<=session.reviews.length)throw new Error('请先提交本轮新的回忆尝试');
  const reviews=[...session.reviews,{id,remembered:Boolean(remembered),createdAt:now}];
  const nextDays=remembered?[3,7,14,30]:[1,1,3,7];
  const index=Math.min(reviews.filter(item=>item.remembered).length-1,nextDays.length-1);
  const delay=remembered?nextDays[Math.max(0,index)]:1;
  return {...session,reviews,task:'review',draft:'',dueAt:new Date(Date.parse(now)+delay*86400000).toISOString(),updatedAt:now};
}

export function dueStudySessions(sessions,now=timestamp()){
  return sessions.filter(session=>session.status==='review'&&session.dueAt&&session.dueAt<=now)
    .sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
}

export function studyContextPacket(session){
  const attempt=session.attempts.filter(item=>item.task===session.task).at(-1)??null;
  return {format:'lmn-study-context/1',sessionId:session.id,attemptId:attempt?.id??null,question:session.title,
    task:session.task,attempt:attempt?.content??session.draft,hintLevel:session.hints.filter(item=>item.task===session.task).length,
    instruction:'你是数学学习教练。先判断学生已展示的证据和缺口；除非明确请求完整解答，否则只提供下一步最小提示，注意量词顺序、反例与可检验证据。请返回 JSON：{ "format":"lmn-study-feedback/1", "sessionId":"原 sessionId", "attemptId":"原 attemptId", "summary":"...", "strengths":["..."], "issues":["..."], "nextAction":"..." }。不要替学生编造已经学会的内容。'};
}

export function parseStudyFeedback(text,session){
  let value;try{value=JSON.parse(text)}catch{throw new Error('AI 反馈必须是有效的 JSON')}
  if(value?.format!==FEEDBACK_FORMAT)throw new Error('反馈格式不匹配（需要 lmn-study-feedback/1）');
  if(value.sessionId!==session.id)throw new Error('反馈属于另一学习会话');
  if(!nonempty(value.attemptId)||!session.attempts.some(item=>item.id===value.attemptId))throw new Error('找不到反馈对应的已保存尝试');
  if(!nonempty(value.summary)||!nonempty(value.nextAction)||!Array.isArray(value.strengths)||!Array.isArray(value.issues)||![...value.strengths,...value.issues].every(nonempty))throw new Error('反馈缺少 summary、strengths、issues 或 nextAction');
  if(JSON.stringify(value).length>20000)throw new Error('反馈过长，请精简');
  return {format:FEEDBACK_FORMAT,sessionId:session.id,attemptId:value.attemptId,
    summary:value.summary.trim(),strengths:value.strengths.map(x=>x.trim()),issues:value.issues.map(x=>x.trim()),nextAction:value.nextAction.trim()};
}

export function acceptStudyFeedback(session,feedback,{now=timestamp(),id=newId()}={}){
  return {...session,feedback:[...session.feedback,{...feedback,id,createdAt:now}],updatedAt:now};
}

export function validateStudyArchive(input){
  let value;try{value=typeof input==='string'?JSON.parse(input):input}catch{throw new Error('学习档案不是有效 JSON')}
  if(value?.format!==STUDY_ARCHIVE_FORMAT||!Array.isArray(value.sessions)||value.sessions.length>10000)throw new Error('不是受支持的 LMN 学习档案');
  for(const session of value.sessions){
    if(!session||!nonempty(session.id)||!nonempty(session.title)||!STUDY_TASKS.includes(session.task)||!['active','review'].includes(session.status)||!Array.isArray(session.attempts)||!Array.isArray(session.hints)||!Array.isArray(session.feedback)||!Array.isArray(session.reviews)||typeof session.draft!=='string'||session.attempts.length>10000||session.hints.length>10000||session.feedback.length>10000||session.reviews.length>10000||!uniqueIds(session.attempts)||!session.attempts.every(item=>nonempty(item.id)&&nonempty(item.content)&&STUDY_TASKS.includes(item.task))||!session.hints.every(item=>STUDY_TASKS.includes(item.task)&&Number.isInteger(item.level))||!session.feedback.every(item=>nonempty(item.id)&&nonempty(item.attemptId)&&session.attempts.some(attempt=>attempt.id===item.attemptId))||!session.reviews.every(item=>nonempty(item.id)&&typeof item.remembered==='boolean'))throw new Error('学习档案包含不合法的会话或尝试');
    // Validate every field consumed by the workbench before anything reaches IndexedDB.
    const validDate=date=>typeof date==='string'&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString()===date;
    if(!validDate(session.createdAt)||!validDate(session.updatedAt)||(session.dueAt!==null&&!validDate(session.dueAt))||
      !['concept','proof','problem','organize'].includes(session.mode)||![null,UNIFORM_N].includes(session.lessonKey)||
      (session.status==='review'&&!session.dueAt)||typeof session.recap!=='string'||
      !session.drafts||!STUDY_TASKS.every(task=>typeof session.drafts[task]==='string')||
      !session.selfChecks||Object.values(session.selfChecks).some(value=>typeof value!=='boolean')||
      !session.attempts.every(item=>validDate(item.createdAt)&&Number.isInteger(item.hintCount)&&item.hintCount>=0)||
      !session.hints.every((item,index)=>session.lessonKey===UNIFORM_N&&item.task==='main'&&item.level===index+1&&item.level<=UNIFORM_N_LESSON.hints.length&&validDate(item.createdAt))||
      !uniqueIds(session.feedback)||!session.feedback.every(item=>validDate(item.createdAt))||
      !uniqueIds(session.reviews)||!session.reviews.every(item=>validDate(item.createdAt))||
      session.reviews.length>session.attempts.filter(item=>item.task==='review').length)
      throw new Error('学习档案包含不合法的日期、草稿、提示或复习记录');
    for(const feedback of session.feedback)parseStudyFeedback(JSON.stringify(feedback),session);
  }
  if(!uniqueIds(value.sessions))throw new Error('学习档案中有重复会话 ID');
  return value.sessions;
}

export const exportStudyArchive=sessions=>JSON.stringify({format:STUDY_ARCHIVE_FORMAT,exportedAt:timestamp(),sessions},null,2);

export function mergeStudySessions(existing,incoming){
  // Import does not replace a newer local session automatically.
  const merged=new Map(existing.map(session=>[session.id,session]));
  for(const session of incoming){const old=merged.get(session.id);if(!old||(session.updatedAt??'')>(old.updatedAt??''))merged.set(session.id,session)}
  return [...merged.values()];
}
