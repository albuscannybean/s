import test from 'node:test';
import assert from 'node:assert/strict';
import {MATH_COURSES} from '../packages/learning/math-content.js';
import {mathDiscoveryById} from '../packages/learning/math-discovery.js';
import {chapterUnits,resolveUnit,powerErrors} from '../packages/learning/math-path.js';

test('the chapter includes every unit once, with prerequisites before its reading and a connected practice route',()=>{
  const visited=new Set();
  for(const unit of chapterUnits){
    const id=unit.knowledge.id;
    assert.ok(!visited.has(id));
    assert.ok(unit.knowledge.prerequisites.every(key=>visited.has(key)),id);
    visited.add(id);
    assert.ok(mathDiscoveryById(unit.discovery));
    assert.ok(unit.problem.knowledgeIds.includes(id));
    assert.ok(unit.problem.methodIds.includes(unit.method.id));
    for(const [view,target] of [['discovery',unit.discovery],['method',unit.method.id],['problem',unit.problem.id]]){
      assert.equal(resolveUnit(view,target,id),unit,id+' / '+view);
    }
  }
  const chapter=MATH_COURSES.flatMap(course=>course.chapters).find(item=>item.id==='course-analysis-13');
  assert.deepEqual([...visited].sort(),[...chapter.knowledgeIds].sort());
});

test('the approximation lab distinguishes the endpoint jump from the integral error',()=>{
  assert.deepEqual(powerErrors(25,1),{uniform:1,integral:1/26});
  const restricted=powerErrors(25,0.8);
  assert.ok(restricted.uniform<0.05);
  assert.ok(restricted.integral<=0.8*restricted.uniform);
});

