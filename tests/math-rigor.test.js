import assert from 'node:assert/strict';
import test from 'node:test';
import {mathDiscoveryById} from '../packages/learning/math-discovery.js';
import {RIGOR_SAMPLE_ID,RIGOR_TERMS,localRigorDate,rigorDateFromSubject,validDailyRigorTasks} from '../packages/learning/math-rigor.js';

test('moving peak concentrates a unit integral at the right endpoint',()=>{
  const sample=mathDiscoveryById(RIGOR_SAMPLE_ID);
  for(const n of RIGOR_TERMS){
    const peak=sample.movingPoint(n,0,1);
    assert.equal(sample.integral(n,0,1),1);
    assert.equal(sample.evaluate(1,n),0);
    assert.ok(sample.evaluate(peak,n)>sample.evaluate(peak-0.01,n));
    assert.ok(sample.evaluate(peak,n)>sample.evaluate(peak+0.01,n));
    assert.ok(Math.abs(sample.integral(n,0,0.8)+sample.integral(n,0.8,1)-1)<1e-12);
  }
  assert.equal(sample.integral(2,0,0.5),0.3125);
  assert.ok(sample.integral(25,0,0.8)<0.02);
  assert.ok(sample.supValue(25,0,1)>sample.supValue(2,0,1));
  assert.equal(sample.uniformOnDomain(0,0.8),true);
  assert.equal(sample.uniformOnDomain(0.2,1),false);
});

test('daily record keys use local dates and reject invalid backup records',()=>{
  assert.equal(localRigorDate(new Date(2028,1,29,23,59)),'2028-02-29');
  assert.equal(rigorDateFromSubject('RIGOR-DAY-2028-02-29'),'2028-02-29');
  assert.equal(rigorDateFromSubject('RIGOR-DAY-2027-02-29'),null);
  assert.equal(rigorDateFromSubject('RIGOR-DAY-2026-04-31'),null);
  assert.ok(validDailyRigorTasks([]));
  assert.ok(validDailyRigorTasks(['examples','transfer']));
  assert.ok(!validDailyRigorTasks(['examples','examples']));
  assert.ok(!validDailyRigorTasks(['impostor']));
});
