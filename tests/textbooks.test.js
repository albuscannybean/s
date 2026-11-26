import test from 'node:test';
import assert from 'node:assert/strict';
import {TEXTBOOKS} from '../packages/learning/textbooks.js';
import {MATH_COURSES,MATH_PROBLEMS,MATH_KNOWLEDGE,MATH_METHODS} from '../packages/learning/math-content.js';
import {semesterPredictions} from '../packages/learning/semester-content.js';
import {MATH_DISCOVERY_CASES} from '../packages/learning/math-discovery.js';
import {renderMathToString} from '../packages/ui/math-markup.js';
import {parsePlotExpression} from '../packages/structure-engine/plotting.js';

test('all seven source editions have stable section and exercise locators',()=>{
  assert.deepEqual(TEXTBOOKS.map(b=>b.chapters.flatMap(c=>c.sections).length),[42,34,43,43,35,25,23]);
  for (const book of TEXTBOOKS) {
    assert.match(book.sha256,/^[a-f0-9]{64}$/);
    const ids=new Set();
    for (const chapter of book.chapters) {
      if (/^\d+$/.test(chapter.number)) assert.equal(chapter.practice.length,2);
      if (chapter.plot) {
        assert.ok(parsePlotExpression(chapter.plot[0]));
        assert.ok(renderMathToString(chapter.plot[1]).ok);
      }
      for (const section of chapter.sections) {
        assert.ok(!ids.has(section.number));ids.add(section.number);
        assert.ok(section.guide);
        for (const page of [section.page,section.exercisePage,...Object.values(section.exercises??{})].filter(p=>p!==undefined))
          assert.ok(Number.isInteger(page)&&page>=section.page&&page<=book.pages,book.id+' '+section.number);
        if (section.exercises) assert.deepEqual(Object.keys(section.exercises).map(Number),Array.from({length:Object.keys(section.exercises).length},(_,i)=>i+1));
      }
    }
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
  visit([TEXTBOOKS,MATH_COURSES,MATH_KNOWLEDGE,MATH_METHODS,MATH_PROBLEMS,semesterPredictions,MATH_DISCOVERY_CASES]);
  assert.deepEqual(errors,[]);
  assert.ok(checked.size>700);
});
