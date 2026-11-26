import test from 'node:test';
import assert from 'node:assert/strict';
import {TEXTBOOK_CHAPTERS} from '../packages/learning/textbook-lessons.js';
import {MATH_COURSES,MATH_PROBLEMS,MATH_KNOWLEDGE,MATH_METHODS} from '../packages/learning/math-content.js';
import {semesterPredictions} from '../packages/learning/semester-content.js';
import {MATH_DISCOVERY_CASES} from '../packages/learning/math-discovery.js';
import {renderMathToString} from '../packages/ui/math-markup.js';
import {parsePlotExpression} from '../packages/structure-engine/plotting.js';

test('each source section maps to one course reading and a native exercise',()=>{
  assert.equal(TEXTBOOK_CHAPTERS.length,47);
  const groups=MATH_COURSES.flatMap(course=>course.chapters.flatMap(chapter=>chapter.groups));
  assert.equal(groups.length,245);
  assert.equal(MATH_PROBLEMS.filter(p=>p.source.kind==='adapted').length,35);
  assert.equal(new Set(MATH_KNOWLEDGE.map(item=>item.code)).size,MATH_KNOWLEDGE.length);
  assert.equal(new Set(MATH_PROBLEMS.map(item=>item.code)).size,MATH_PROBLEMS.length);
  for(const group of groups){
    const unit=MATH_KNOWLEDGE.find(item=>item.id===group.id);
    assert.ok(unit.source.page>0&&unit.body.length>45);
    assert.ok(unit.relatedIds.every(key=>MATH_KNOWLEDGE.some(k=>k.id===key)));
    const problem=MATH_PROBLEMS.find(item=>item.id===group.problemIds[0]);
    assert.deepEqual(problem.knowledgeIds,[unit.id]);
    assert.match(problem.code,new RegExp('^'+unit.code.replace('.','\\.')+'-P01$'));
  }
  for(const chapter of TEXTBOOK_CHAPTERS)if(chapter.plot){
    assert.ok(parsePlotExpression(chapter.plot[0]));
    assert.ok(renderMathToString(chapter.plot[1]).ok);
  }
});

test('all authored textbook, archive and prediction expressions compile with the shipped KaTeX',()=>{
  const errors=[],checked=new Set();
  function visit(value){
    if(value && typeof value==='object'){Object.values(value).forEach(visit);return;}
    if(typeof value!=='string')return;
    for(const match of value.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)){
      const expression=match[1]??match[2];
      if(checked.has(expression))continue;
      checked.add(expression);
      const result=renderMathToString(expression,{display:match[1]!==undefined});
      if(!result.ok)errors.push(expression+'  '+result.error.message);
    }
    if(value.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g,'').includes('$')) errors.push('Unpaired delimiter in '+value);
  }
  visit([TEXTBOOK_CHAPTERS,MATH_COURSES,MATH_KNOWLEDGE,MATH_METHODS,MATH_PROBLEMS,semesterPredictions,MATH_DISCOVERY_CASES]);
  assert.deepEqual(errors,[]);
  assert.ok(checked.size>700);
});
