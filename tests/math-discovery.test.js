import test from 'node:test';
import assert from 'node:assert/strict';
import {MATH_DISCOVERY_CASES,mathDiscoveryById,mathDiscoveryDomain,validateMathDiscoveryContent} from '../packages/learning/math-discovery.js';

test('discovery material is a cross-linked collection of distinct mathematical specimens',()=>{
  assert.equal(MATH_DISCOVERY_CASES.length,7);
  assert.deepEqual(validateMathDiscoveryContent(),[]);
  assert.equal(new Set(MATH_DISCOVERY_CASES.map(item=>item.id)).size,7);
  assert.ok(MATH_DISCOVERY_CASES.every(item=>item.knowledgeIds.length>0&&item.problemIds.length>0));
});

test('fixed-point and moving-point observations expose different behaviours',()=>{
  const power=mathDiscoveryById('SEQ-POWER');
  assert.equal(power.evaluate(0.5,4),0.0625);
  assert.equal(power.movingPoint(4,0,1),0.75);
  assert.ok(Math.abs(power.evaluate(power.movingPoint(32,0,1),32)-Math.exp(-1))<0.02);
  const spike=mathDiscoveryById('SEQ-SPIKE');
  assert.equal(spike.evaluate(1/8,8),1);
  assert.equal(spike.supValue(8,0,1),1);
  assert.equal(spike.evaluate(0.5,32),0);
  const peak=mathDiscoveryById('SEQ-PEAK');
  assert.ok(Math.abs(peak.evaluate(1/8,8)-1/Math.E)<1e-12);
  assert.equal(peak.uniformOnDomain(0,1),false);
  assert.equal(peak.uniformOnDomain(0.2,1),true);
});

test('domain changes and uniform error bounds are computed independently of a forced lesson path',()=>{
  const power=mathDiscoveryById('SEQ-POWER');
  assert.equal(power.uniformOnDomain(0,1),false);
  assert.equal(power.uniformOnDomain(0,0.8),true);
  const linear=mathDiscoveryById('SEQ-LINEAR');
  assert.equal(linear.supValue(10,0,1),0.1);
  assert.equal(linear.uniformOnDomain(0,1),true);
  const sine=mathDiscoveryById('SEQ-SINE');
  assert.equal(sine.supValue(8,0,1),0.125);
  const reciprocal=mathDiscoveryById('SEQ-RECIPROCAL');
  assert.equal(reciprocal.limitAt(0),1);
  assert.equal(reciprocal.limitAt(0.25),0);
  assert.equal(reciprocal.uniformOnDomain(0,1),false);
  assert.equal(reciprocal.uniformOnDomain(0.2,1),true);
  assert.deepEqual(mathDiscoveryDomain('0.2:1'),{lo:0.2,hi:1});
  assert.deepEqual(mathDiscoveryDomain('invalid'),{lo:0,hi:1});
});
