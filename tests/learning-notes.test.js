import test from 'node:test';
import assert from 'node:assert/strict';
import {learningNoteBody,LEARNING_MODES} from '../packages/ui/learning-notes.js';

test('learning note modes produce editable, non-empty Markdown without fixed LMN schema',()=>{
  assert.deepEqual(LEARNING_MODES,['concept','proof','problem','organize']);
  for(const mode of LEARNING_MODES){
    const body=learningNoteBody(mode);
    assert.match(body,/^## /);
    assert.ok(body.split('\n').filter(line=>line.startsWith('## ')).length>=4);
    assert.doesNotMatch(body,/4·4·4|```json|LKL/);
  }
});

test('proof and problem paths explicitly reserve independent attempts and verification',()=>{
  assert.match(learningNoteBody('proof'),/自己的证明/);
  assert.match(learningNoteBody('proof'),/独立复现/);
  assert.match(learningNoteBody('problem'),/独立尝试/);
  assert.match(learningNoteBody('problem'),/核验与错误/);
  assert.equal(learningNoteBody('invalid'),learningNoteBody('concept'));
  assert.match(learningNoteBody('proof','en'),/Reproduce independently/);
});
