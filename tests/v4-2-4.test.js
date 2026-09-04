import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {buildSceneGeometry,projectCoordinate} from '../packages/geometry/scene-geometry.js';
import {parseStructureInstanceSource,parseStructureTemplateDefaultsSource,serializeStructureInstance,serializeStructureTemplateDefaults} from '../packages/lkl2/index.js';
import {evaluateMathExpression,numericalDerivative,numericalIntegral,numericalLimit,numericalSeries,samplePlotExpression} from '../packages/structure-engine/plotting.js';
import {ensureStructureView,setStructureArrangement,structureViewCapability} from '../packages/structure-engine/structure-view.js';
import {pointAlongPolyline} from '../packages/ui/structure-renderer.js';

test('template defaults are directly editable and round-trip through LKL 2',()=>{
  const template=structuredClone(getBuiltinTemplate('builtin:poset-hasse'));
  const source=serializeStructureTemplateDefaults(template).replace('a < b < c','x < y < z').replace('"#446D82"','"#225577"');
  const parsed=parseStructureTemplateDefaultsSource(source,{template});
  assert.equal(parsed.valid,true,parsed.diagnostics[0]?.message);
  assert.equal(parsed.draft.parameters.find(item=>item.id==='relationText').defaultValue,'x < y < z');
  assert.equal(parsed.draft.visual.accent,'#225577');
  assert.equal(parsed.draft.viewCapability.mode,'arrange');
});

test('center relation labels use the geometric midpoint of the complete route',()=>{
  const point=pointAlongPolyline([{x:0,y:0},{x:100,y:0},{x:100,y:300}],.5);
  assert.deepEqual(point,{x:100,y:100});
});

test('structure view capabilities separate arrangement from rotation',()=>{
  const timeline=getBuiltinTemplate('builtin:timeline'),polygon=getBuiltinTemplate('builtin:regular-polygon');
  assert.equal(structureViewCapability(timeline).mode,'arrange');
  assert.equal(structureViewCapability(polygon).mode,'rotate');
  const instance=createStructureInstance(timeline,'knowledge');
  setStructureArrangement(instance,timeline,'vertical');
  assert.equal(ensureStructureView(instance).arrangement,'vertical-forward');
  assert.deepEqual(structureViewCapability(timeline).options,['horizontal-forward','horizontal-reverse','vertical-forward','vertical-reverse']);
});

test('Proof Tree supports four deterministic directions with premise before conclusion',()=>{
  const template=getBuiltinTemplate('builtin:proof-tree'),instance=createStructureInstance(template,'knowledge'),positions=arrangement=>{setStructureArrangement(instance,template,arrangement);return new Map(buildSceneGeometry(materializeInstanceDefinition(template,instance),instance).nodes.map(node=>[node.role,node]))};
  let nodes=positions('horizontal-forward');assert.ok(nodes.get('premise').x<nodes.get('inference').x&&nodes.get('inference').x<nodes.get('conclusion').x);
  nodes=positions('horizontal-reverse');assert.ok(nodes.get('premise').x>nodes.get('inference').x&&nodes.get('inference').x>nodes.get('conclusion').x);
  nodes=positions('vertical-forward');assert.ok(nodes.get('premise').y<nodes.get('inference').y&&nodes.get('inference').y<nodes.get('conclusion').y);
  nodes=positions('vertical-reverse');assert.ok(nodes.get('premise').y>nodes.get('inference').y&&nodes.get('inference').y>nodes.get('conclusion').y);
});

test('vector space supports constants, calculus, adaptive coordinates and 3D surfaces',()=>{
  assert.equal(evaluateMathExpression('2*pi+e'),2*Math.PI+Math.E);
  assert.ok(Math.abs(numericalDerivative('y=sin(x)',0)-1)<1e-5);
  assert.ok(Math.abs(numericalIntegral('y=x',0,2)-2)<1e-6);
  assert.ok(Math.abs(numericalLimit('y=sin(x)',0))<1e-4);
  assert.equal(numericalSeries('y=x',1,4),10);
  const surface=samplePlotExpression('sphere(cx=0, cy=0, cz=0, r=2)');
  assert.equal(surface.kind,'surface');assert.ok(surface.segments.length>20);
  const template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,'knowledge',{dimension:'3d',scale:40});
  instance.plotExpressions=[{id:'surface',label:'球面',source:'sphere(cx=0, cy=0, cz=0, r=2)',range:[0,Math.PI*2]}];
  const origin=projectCoordinate({},instance),z=projectCoordinate({z:2},instance),scene=buildSceneGeometry(materializeInstanceDefinition(template,instance),instance,{zoom:2,worldViewport:{left:100,right:900,top:20,bottom:700}});
  assert.equal(z.x,origin.x);assert.ok(z.y<origin.y);
  assert.ok(scene.background.some(item=>item.className?.includes('coordinate-surface-mesh')));
  assert.ok(scene.background.some(item=>item.className?.includes('coordinate-tick-3d')));
});

test('instance LKL preserves global design, plots and motion points',()=>{
  const template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,'knowledge');
  instance.designStyles.nodeDefault={fill:'#888888',stroke:'#111111',borderWidth:2,radius:9};
  instance.relationStyles.structureDefault={color:'#334455',width:2,labelPosition:'center'};
  instance.plotExpressions=[{id:'curve',label:'圆',source:'circle(cx=0, cy=0, r=2)',range:[0,Math.PI*2]}];
  instance.motionPoints=[{id:'motion',plotId:'curve',label:'M',start:0,end:Math.PI,current:0,mode:'pingpong',duration:4,playing:false}];
  const parsed=parseStructureInstanceSource(serializeStructureInstance(template,instance),{template,instance});
  assert.equal(parsed.valid,true,parsed.diagnostics[0]?.message);
  assert.equal(parsed.draft.designStyles.nodeDefault.fill,'#888888');
  assert.equal(parsed.draft.relationStyles.structureDefault.labelPosition,'center');
  assert.equal(parsed.draft.plotExpressions[0].id,'curve');
  assert.equal(parsed.draft.motionPoints[0].mode,'pingpong');
});

test('V4.2.4 UI exposes settings, design, zoomable preview, timeline wiring and knowledge deletion',()=>{
  const controller=fs.readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8');
  assert.match(html,/V4\.3\.[01](?: RC)?/);assert.match(html,/id="sourcePreviewZoom"/);assert.match(html,/知识库/);
  assert.match(controller,/\['settings','设置'\]/);assert.match(controller,/\['design','设计'\]/);
  assert.match(controller,/addTimelineNode/);assert.match(controller,/label:'演化'/);assert.match(controller,/visual:\{labelPosition:'center'\}/);
  assert.match(controller,/删除知识…/);assert.match(controller,/undoDeleteAction/);
  assert.match(controller,/renderMotionPointWorkbench/);assert.match(controller,/removeCoordinateObject/);
});
