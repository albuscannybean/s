import test from 'node:test';
import assert from 'node:assert/strict';
import { cyclicOrbit,bernoulliLaw,logisticSlope,logisticValue,EXPERIMENTS } from '../packages/learning/math-experiments.js';
import { mathKnowledgeById,mathProblemById } from '../packages/learning/math-content.js';
import { readProgress,recordReading,mergeReadingProgress } from '../packages/learning/reading-progress.js';

test('the cyclic laboratory enumerates cosets and handles zero and negative residues',()=>{
  assert.deepEqual(cyclicOrbit(8,2),{order:4,index:2,orbit:[0,2,4,6],cosets:[[0,2,4,6],[1,3,5,7]]});
  assert.deepEqual(cyclicOrbit(8,-1).orbit,[0,7,6,5,4,3,2,1]);
  assert.equal(cyclicOrbit(8,0).order,1);
  for(let n=2;n<32;n++)for(let g=0;g<n;g++){
    const {order,index,cosets}=cyclicOrbit(n,g);
    assert.equal(order*index,n);
    assert.equal(new Set(cosets.flat()).size,n);
  }
});

test('the binomial law normalizes and conditioning keeps the zero-probability case undefined',()=>{
  const fair=bernoulliLaw(2,0.5);
  assert.deepEqual(fair.distribution,[0.25,0.5,0.25]);
  assert.equal(fair.conditional,2/3);
  assert.equal(bernoulliLaw(6,0).conditional,null);
  assert.equal(bernoulliLaw(6,1).conditional,1);
  assert.ok(Math.abs(bernoulliLaw(16,0.33).distribution.reduce((a,b)=>a+b,0)-1)<1e-12);
});

test('the logistic solution satisfies the initial value, equilibria, and its differential equation',()=>{
  for(const y0 of [0,0.2,1,1.4])assert.equal(logisticValue(0,y0,1.5),y0);
  assert.equal(logisticValue(2,0,1),0);
  assert.equal(logisticValue(2,1,1),1);
  const t=1.4,r=1.5,y0=0.3,h=0.00001;
  const derivative=(logisticValue(t+h,y0,r)-logisticValue(t-h,y0,r))/(2*h);
  assert.ok(Math.abs(derivative-logisticSlope(logisticValue(t,y0,r),r))<1e-8);
  for(const lab of EXPERIMENTS){
    assert.ok(mathKnowledgeById(lab.knowledgeId));
    assert.ok(mathProblemById(lab.problemId));
  }
});

test('reading positions merge by freshness while keeping both sets of opened lessons',()=>{
  const memory=new Map();
  const storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
  recordReading('course-algebra','ALG-K01',100,storage,200);
  mergeReadingProgress({'course-algebra':{unitId:'ALG-K02',offset:2,at:100,opened:['ALG-K02']}},storage);
  assert.deepEqual(readProgress(storage)['course-algebra'],
    {unitId:'ALG-K01',offset:100,at:200,opened:['ALG-K01','ALG-K02']});
});

