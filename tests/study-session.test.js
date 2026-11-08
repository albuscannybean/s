import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptStudyFeedback,changeStudyTask,createStudySession,dueStudySessions,exportStudyArchive,finishStudySession,isUniformNTopic,mergeStudySessions,parseStudyFeedback,recordStudyReview,revealStudyHint,studyContextPacket,submitStudyAttempt,UNIFORM_N_LESSON,updateStudyDraft,validateStudyArchive} from '../packages/learning/study-session.js';

const day='2026-11-08T10:00:00.000Z';
const start=()=>createStudySession({title:'一致收敛为何要求统一的 N？',id:'session-1',now:day});
const attempt=session=>submitStudyAttempt(updateStudyDraft(session,'我知道逐点收敛的 N 依赖 x，但不确定反例。',{now:day}),{now:day,id:'attempt-1'});

test('learning sessions remain separate from knowledge objects, with no inferred mastery',()=>{
  const s=start();assert.equal(s.lessonKey,'uniform-n');assert.equal(s.attempts.length,0);assert.equal(s.selfChecks.definition,undefined);
  assert.equal(isUniformNTopic('数列收敛'),false);
  assert.equal(s.chapterId,null);assert.ok(!('objectContent'in s));
});

test('an independent written attempt is required before progressively revealing four hints',()=>{
  assert.throws(()=>submitStudyAttempt(start()),/先写下/);
  assert.throws(()=>revealStudyHint(start()),/独立尝试/);
  let s=attempt(start());assert.equal(s.attempts[0].hintCount,0);assert.equal(s.draft,'');
  for(let i=1;i<=4;i++){s=revealStudyHint(s,{now:day});assert.equal(s.hints.at(-1).level,i)}
  assert.throws(()=>revealStudyHint(s),/全部提示/);
  s=submitStudyAttempt(updateStudyDraft(s,'现在可以使用 $x_n=2^{-1/n}$',{now:day}),{now:day,id:'attempt-2'});
  assert.equal(s.attempts[1].hintCount,4);
  assert.match(UNIFORM_N_LESSON.hints[2],/2\^\{-1\/n\}/);
  assert.match(UNIFORM_N_LESSON.transfer,/0<a<1/);
});

test('task switching preserves drafts and transfer requires an initial attempt',()=>{
  assert.throws(()=>changeStudyTask(start(),'transfer'),/初始尝试/);
  let s=attempt(start());s=updateStudyDraft(s,'新一轮的思考',{now:day});s=changeStudyTask(s,'transfer',{now:day});
  assert.equal(s.draft,'');s=updateStudyDraft(s,'先取上界 a^n',{now:day});
  assert.equal(changeStudyTask(s,'main',{now:day}).draft,'新一轮的思考');
  assert.equal(changeStudyTask(s,'transfer',{now:day}).draft,'先取上界 a^n');
  assert.equal(studyContextPacket(s).attemptId,null,'a new task must not re-use a different task attempt');
});

test('AI feedback packets must reference a submitted attempt; preview precedes acceptance',()=>{
  const s=attempt(start()),packet=studyContextPacket(s);assert.equal(packet.attemptId,'attempt-1');assert.ok(packet.instruction.includes('最小提示'));
  const value={format:'lmn-study-feedback/1',sessionId:'session-1',attemptId:'attempt-1',summary:'量词尚未完整',strengths:['已经区分依赖性'],issues:['未构造具体 x_n'],nextAction:'先尝试令 x_n^n=1/2'};
  assert.throws(()=>parseStudyFeedback(JSON.stringify({...value,sessionId:'wrong'}),s),/另一学习会话/);
  assert.throws(()=>parseStudyFeedback(JSON.stringify({...value,attemptId:'unknown'}),s),/找不到反馈/);
  assert.throws(()=>parseStudyFeedback('not-json',s),/有效的 JSON/);
  const accepted=acceptStudyFeedback(s,parseStudyFeedback(JSON.stringify(value),s),{now:day,id:'feedback-1'});
  assert.equal(accepted.feedback[0].attemptId,'attempt-1');assert.equal(s.feedback.length,0);
});

test('delayed recall requires a fresh retrieval attempt and schedules a follow-up',()=>{
  let s=finishStudySession(attempt(start()),{now:day});
  assert.equal(s.dueAt,'2026-11-09T10:00:00.000Z');assert.equal(dueStudySessions([s],'2026-11-08T10:00:00.000Z').length,0);
  assert.deepEqual(dueStudySessions([s],'2026-11-09T12:00:00.000Z').map(item=>item.id),['session-1']);
  assert.throws(()=>recordStudyReview(s),/新的回忆尝试/);
  s=submitStudyAttempt(updateStudyDraft(s,'不看笔记复述：∀ ε ∃N ∀x',{now:day}),{now:day,id:'review-1'});
  s=recordStudyReview(s,{now:'2026-11-09T10:00:00.000Z',remembered:true,id:'record-1'});
  assert.equal(s.dueAt,'2026-11-12T10:00:00.000Z');
  assert.throws(()=>recordStudyReview(s),/新的回忆尝试/);
});

test('study archive validates and merges by identity without discarding newer local edits',()=>{
  const local=attempt(start()),incoming={...local,updatedAt:'2026-11-07T10:00:00.000Z',draft:'old'};
  assert.equal(validateStudyArchive(exportStudyArchive([local]))[0].attempts.length,1);
  assert.equal(mergeStudySessions([local],[incoming])[0].attempts.length,1);
  assert.equal(mergeStudySessions([local],[incoming])[0].draft,'');
  assert.throws(()=>validateStudyArchive('{"format":"lmn-study-sessions/1","sessions":[{"id":"a"}]}'),/不合法/);
  assert.throws(()=>validateStudyArchive({format:'lmn-study-sessions/1',sessions:[local,local]}),/重复/);
});

test('archive rejects malformed data that would break rendering or overwrite local edits',()=>{
  const local=attempt(start());
  const validate=session=>validateStudyArchive({format:'lmn-study-sessions/1',sessions:[session]});
  for(const change of [
    {updatedAt:'tomorrow'}, {drafts:{main:123}}, {lessonKey:'unknown'},
    {hints:[{task:'main',level:99,createdAt:day}]},
    {feedback:[{id:'f',attemptId:'attempt-1',sessionId:local.id,createdAt:day}]},
    {reviews:[{id:'r',remembered:true,createdAt:day}]}
  ])assert.throws(()=>validate({...local,...change}));
  const feedback=parseStudyFeedback(JSON.stringify({format:'lmn-study-feedback/1',sessionId:local.id,attemptId:'attempt-1',summary:'继续验证',strengths:[],issues:['缺反例'],nextAction:'构造反例'}),local);
  const complete=acceptStudyFeedback(revealStudyHint(local,{now:day}),feedback,{now:day,id:'f'});
  assert.deepEqual(validate(complete),[complete]);
});
