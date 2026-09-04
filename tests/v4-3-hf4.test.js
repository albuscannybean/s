import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createGeometryPrimitive,evaluateGeometryPrimitive} from '../packages/geometry/geometry-primitives.js';
import {geometryOperandsFromSelection,geometryOperationAvailability} from '../packages/structure-engine/coordinate-operations.js';
import {geometrySelectionSummary} from '../packages/geometry/geometry-operands.js';
import {evaluatePlotPoint} from '../packages/structure-engine/plotting.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {createStructureInstance} from '../packages/structure-engine/model.js';
import {importKnowledgePackage,serializeKnowledgePackage} from '../packages/lkl2/index.js';
import {parseStructureInstanceSource,serializeStructureInstance} from '../packages/lkl2/structure-source.js';

const definition={slots:[
  {id:'A',semanticCoordinate:{x:0,y:0,z:0}},
  {id:'B',semanticCoordinate:{x:4,y:0,z:0}},
  {id:'C',semanticCoordinate:{x:0,y:3,z:0}},
  {id:'D',semanticCoordinate:{x:0,y:0,z:2}},
  {id:'L',semanticCoordinate:{x:-1,y:0,z:0}},
  {id:'R',semanticCoordinate:{x:1,y:0,z:0}}
],edges:[]};
const instance=()=>({parameters:{dimension:'2d'},motionPoints:[{id:'M1',plotId:'motion-curve',current:1,start:0},{id:'M2',plotId:'motion-curve',current:2,start:0}],plotExpressions:[{id:'motion-curve',source:'x=t; y=t^2'},{id:'circle',source:'circle(cx=0, cy=0, r=2)'},{id:'open',source:'y=x'},{id:'semi',source:'x=cos(t); y=sin(t)',range:[0,Math.PI],rangeMode:'manual'},{id:'sphere',source:'sphere(cx=0, cy=0, cz=0, r=2)'},{id:'paraboloid',source:'paraboloid(a=.2, size=4)'}],geometryPrimitives:[],objectVisibility:{}});
const context=current=>({instance:current,definition,evaluatePlotPoint,dimension:current.parameters.dimension});

test('HF4 geometry operands preserve selection order and every supported namespace',()=>{
  const current=instance(),line=createGeometryPrimitive('line',[{type:'slot',id:'A'},{type:'motion',id:'M1'}],{id:'line-1'});current.geometryPrimitives.push(line);
  const operands=geometryOperandsFromSelection(new Set(['slot:A','motion:M1','geometry:line-1','plot:circle','plot:sphere']),context(current));
  assert.deepEqual(operands.map(item=>item.kind),['point','point','line','curve','surface']);
  assert.equal(geometrySelectionSummary(operands),'1 点 · 1 动点 · 1 直线 · 1 曲线 · 1 曲面');
});

test('HF4 area resolver accepts point polygons, closed lines, closed curves, and mixed boundaries',()=>{
  const current=instance(),ctx=context(current);
  assert.equal(geometryOperationAvailability(new Set(['slot:A','slot:B','slot:C']),ctx).area,true);
  current.geometryPrimitives.push(
    createGeometryPrimitive('line',[{type:'slot',id:'A'},{type:'slot',id:'B'}],{id:'AB'}),
    createGeometryPrimitive('line',[{type:'slot',id:'B'},{type:'slot',id:'C'}],{id:'BC'}),
    createGeometryPrimitive('line',[{type:'slot',id:'C'},{type:'slot',id:'A'}],{id:'CA'}),
    createGeometryPrimitive('line',[{type:'slot',id:'L'},{type:'slot',id:'R'}],{id:'diameter'})
  );
  assert.equal(geometryOperationAvailability(new Set(['geometry:AB','geometry:BC','geometry:CA']),ctx).area,true);
  const circle=geometryOperationAvailability(new Set(['plot:circle']),ctx);assert.equal(circle.area,true);assert.ok(Math.abs(circle.measurements.area.value-Math.PI*4)<.02);
  const open=geometryOperationAvailability(new Set(['plot:open']),ctx);assert.equal(open.area,false);assert.match(open.reasons.area,/没有形成闭合边界/);
  const mixed=geometryOperationAvailability(new Set(['plot:semi','geometry:diameter']),ctx);assert.equal(mixed.area,true);assert.ok(Math.abs(mixed.measurements.area.value-Math.PI/2)<.02);
});

test('HF4 surface area and volume reject open surfaces and calculate known closed meshes',()=>{
  const current=instance();current.parameters.dimension='3d';const ctx=context(current),sphere=geometryOperationAvailability(new Set(['plot:sphere']),ctx);
  assert.equal(sphere.area,true);assert.equal(sphere.volume,true);assert.ok(Math.abs(sphere.measurements.area.value-16*Math.PI)<.15);assert.ok(Math.abs(sphere.measurements.volume.value-32*Math.PI/3)<.15);
  const open=geometryOperationAvailability(new Set(['plot:paraboloid']),ctx);assert.equal(open.area,false);assert.equal(open.volume,false);assert.match(open.reasons.area,/开放\/无限曲面/);assert.match(open.reasons.volume,/没有形成闭合三维边界/);
  assert.equal(geometryOperationAvailability(new Set(['slot:A','slot:B','slot:C','slot:D']),ctx).volume,true);
  current.parameters.dimension='2d';assert.equal(geometryOperationAvailability(new Set(['slot:A','slot:B','slot:C','slot:D']),context(current)).volume,false);
});

test('HF4 geometry primitives retain live motion and geometry dependencies',()=>{
  const current=instance(),dynamicLine=createGeometryPrimitive('line',[{type:'slot',id:'A'},{type:'motion',id:'M1'}],{id:'dynamic-line'});current.geometryPrimitives.push(dynamicLine);
  const before=evaluateGeometryPrimitive(dynamicLine,context(current));current.motionPoints[0].current=2;const after=evaluateGeometryPrimitive(dynamicLine,context(current));assert.notEqual(before.points[1].x,after.points[1].x);assert.notEqual(before.value,after.value);
  const area=createGeometryPrimitive('area',[{type:'geometry',id:'dynamic-line'},{type:'geometry',id:'diameter'}],{id:'derived-area'});assert.deepEqual(area.operandRefs.map(ref=>ref.type),['geometry','geometry']);
});

test('LKL 2.1 operand grammar round-trips plot and geometry dependencies',()=>{
  const source=`lkl 2
package hf4 {
  id "hf4"
  title "HF4"
  version "1"
  root knowledge root
}
knowledge root {
  title "Root"
}
structure-instance plane {
  using builtin:coordinate-plane
  owner root
  runtime "{\\"plotExpressions\\":[{\\"id\\":\\"C1\\",\\"source\\":\\"circle(cx=0, cy=0, r=2)\\"}],\\"motionPoints\\":[]}"
  geometry g-line {
    type "line"
    operand slot origin
    operand slot P
  }
  geometry g-area {
    type "area"
    operand plot C1
  }
}`;
  const parsed=importKnowledgePackage(source,{templates:BUILTIN_TEMPLATES});assert.equal(parsed.valid,true,JSON.stringify(parsed.diagnostics));assert.deepEqual(parsed.package.structureInstances[0].geometries[1].operandRefs,[{type:'plot',id:'C1'}]);
  const exported=serializeKnowledgePackage(parsed.package);assert.match(exported,/operand plot C1/);const reparsed=importKnowledgePackage(exported,{templates:BUILTIN_TEMPLATES});assert.equal(reparsed.valid,true,`${exported}\n${JSON.stringify(reparsed.diagnostics)}`);assert.deepEqual(reparsed.package.structureInstances[0].geometries[1].operandRefs,[{type:'plot',id:'C1'}]);
});

test('structure source retains operandRefs while old point syntax stays compatible',()=>{
  const template=BUILTIN_TEMPLATES.find(item=>item.id==='builtin:coordinate-plane'),current=createStructureInstance(template,'root',{dimension:'2d'});current.plotExpressions=[{id:'C1',source:'circle(cx=0, cy=0, r=2)'}];current.geometryPrimitives=[createGeometryPrimitive('area',[{type:'plot',id:'C1'}],{id:'circle-area'})];
  const source=serializeStructureInstance(template,current);assert.match(source,/operand plot C1/);const parsed=parseStructureInstanceSource(source,{template,instance:current});assert.equal(parsed.valid,true,JSON.stringify(parsed.diagnostics));assert.deepEqual(parsed.draft.geometryPrimitives[0].operandRefs,[{type:'plot',id:'C1'}]);
});

test('HF4 ships global Home navigation, unified search routing, resilient hit tests, and fresh cache',async()=>{
  const controller=await fs.readFile(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),renderer=await fs.readFile(new URL('../packages/ui/structure-renderer.js',import.meta.url),'utf8'),styles=await fs.readFile(new URL('../apps/web/styles.css',import.meta.url),'utf8'),metadata=await fs.readFile(new URL('../packages/app-metadata.js',import.meta.url),'utf8'),worker=await fs.readFile(new URL('../apps/web/sw.js',import.meta.url),'utf8');
  assert.match(controller,/if\(!\(this\.state\.knowledge\?\?\[\]\)\.length\)/);assert.doesNotMatch(controller,/if\(!this\.knowledge\)\{root\.innerHTML='<p class="nav-empty">新建知识后/);assert.match(controller,/openSearchResult\(target/);assert.match(controller,/elementsFromPoint/);assert.match(controller,/distance<=14/);
  assert.match(renderer,/coordinate-motion-hit/);assert.match(renderer,/geometry-line-hit/);assert.match(styles,/\.coordinate-plot-hit\{[^}]*stroke-width:16/);assert.match(metadata,/APP_HOTFIX='V4\.3\.1'/);assert.match(worker,/lmn-v4\.3\.1-stable-20260904-1/);assert.match(worker,/geometry\/geometry-operands\.js/);
});
