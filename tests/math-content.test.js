import test from 'node:test';
import assert from 'node:assert/strict';
import {MATH_CONTENT_VERSION,MATH_COURSES,MATH_KNOWLEDGE,MATH_METHODS,MATH_PROBLEMS,mathKnowledgeById,mathProblemById,mathProblemsForKnowledge,searchMathContent,validateMathContent} from '../packages/learning/math-content.js';
import {createStudySession,revealStudyHint,studyContextPacket,submitStudyAttempt,updateStudyDraft,validateStudyArchive,exportStudyArchive} from '../packages/learning/study-session.js';
import {renderMathToString} from '../packages/ui/math-markup.js';

test('published teaching unit contains 10 complete concepts, 20 original problems and 5 methods with valid references',()=>{
  assert.equal(MATH_CONTENT_VERSION,'math-content/1');assert.equal(MATH_COURSES.length,1);
  assert.equal(MATH_KNOWLEDGE.length,10);assert.equal(MATH_PROBLEMS.length,20);assert.equal(MATH_METHODS.length,5);
  assert.deepEqual(validateMathContent(),[]);
  assert.ok(MATH_KNOWLEDGE.every(item=>item.body.length>300));
  assert.ok(MATH_PROBLEMS.every(item=>item.solution.length>70&&item.hints.length>=1&&item.knowledgeIds.length>=1));
  assert.ok(mathProblemsForKnowledge('ANA-UC-K02').length>=10);
});

test('problems retain their real mathematical identities and crosslinked content',()=>{
  assert.match(mathKnowledgeById('ANA-UC-K02').body,/\\forall\\varepsilon/);
  assert.match(mathProblemById('ANA-UC-P02').solution,/\\sup/);
  assert.match(mathProblemById('ANA-UC-P16').solution,/1\/4/);
  assert.equal(searchMathContent(MATH_PROBLEMS,{type:'反例构造'}).length,2);
  assert.ok(searchMathContent(MATH_PROBLEMS,{text:'Cauchy'}).length>=2);
  assert.ok(searchMathContent(MATH_PROBLEMS,{difficulty:'4'}).every(item=>item.difficulty===4));
});

test('all published LaTeX snippets parse with the local mathematical renderer',()=>{
  for(const item of [...MATH_KNOWLEDGE,...MATH_PROBLEMS,...MATH_METHODS]){
    const fields=[item.body,item.prompt,item.solution,item.transfer,item.trigger,item.action,item.reason,item.boundary,...(item.hints??[])].filter(Boolean);
    for(const field of fields)for(const match of field.matchAll(/\$\$([\s\S]*?)\$\$|\$([^\n$]+)\$/g)){
      const expression=match[1]??match[2],rendered=renderMathToString(expression);
      assert.ok(rendered.ok,`${item.id}: ${expression} — ${rendered.error?.message}`);
    }
  }
});

test('a real problem becomes a resumable session with progressive hints and answer-free AI request',()=>{
  const first=createStudySession({title:mathProblemById('ANA-UC-P02').title,problemId:'ANA-UC-P02',mode:'problem',id:'math-test',now:'2026-11-08T00:00:00.000Z'});
  assert.throws(()=>revealStudyHint(first),/先保存至少一次/);
  const drafted=updateStudyDraft(first,'我认为所有 x 的 N 可以不同',{now:'2026-11-08T00:00:01.000Z'});
  const submitted=submitStudyAttempt(drafted,{id:'attempt-test',now:'2026-11-08T00:00:02.000Z'});
  const hinted=revealStudyHint(submitted,{now:'2026-11-08T00:00:03.000Z'});
  assert.equal(hinted.hints[0].level,1);
  const packet=studyContextPacket(hinted);
  assert.equal(packet.problemId,'ANA-UC-P02');assert.equal(packet.attemptId,'attempt-test');assert.match(packet.problemStatement,/x\^n/);
  assert.ok(!('solution' in packet));
  assert.equal(validateStudyArchive(exportStudyArchive([hinted]))[0].problemId,'ANA-UC-P02');
  assert.throws(()=>createStudySession({title:'不存在',problemId:'ANA-UC-UNKNOWN'}),/不存在/);
});
