import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PLOT_PRESETS,evaluateMathExpression,numericalDerivative,numericalIntegral,samplePlotExpression} from '../packages/structure-engine/plotting.js';
import {createPosetStarter,parseRelationText} from '../packages/structure-engine/poset.js';
import {generateBooleanAlgebra} from '../packages/structure-engine/boolean-algebra.js';
import {BUILTIN_TEMPLATES,getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {bindTarget,createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';
import {libraryEntries} from '../packages/ui/library-model.js';

test('safe plotting expressions support functions, powers, derivatives and integrals',()=>{
  assert.ok(Math.abs(evaluateMathExpression('sin(pi/2)+2^3')-9)<1e-10);
  assert.ok(Math.abs(numericalDerivative('y=x^3',2)-12)<1e-4);
  assert.ok(Math.abs(numericalIntegral('y=x^2',0,3)-9)<1e-5);
  assert.throws(()=>evaluateMathExpression('window.alert(1)'),/不支持|无法|未知/);
});

test('plot sampler handles heart, cycloid, conics and 3D parametric curves',()=>{
  for(const key of['heart','cycloid','circle','ellipse','parabola','helix']){const sampled=samplePlotExpression(PLOT_PRESETS[key].source);assert.ok(sampled.segments.flat().length>100,key)}
  assert.equal(samplePlotExpression(PLOT_PRESETS.helix.source).dimension,'3d');
  assert.match(PLOT_PRESETS.heart.source,/scale=1/);
  assert.throws(()=>samplePlotExpression('heart'),/显式参数/);
});

test('Poset relation text expands chained and separated relations',()=>{
  const parsed=parseRelationText('a < b < c; a < d\nd < e');
  assert.deepEqual(new Set(parsed.slots.map(item=>item.label)),new Set(['a','b','c','d','e']));
  assert.equal(parsed.edges.length,4);
  const starter=createPosetStarter('relation-text','0 ≤ 1 ≤ 2');
  assert.equal(starter.slots.length,3);
  assert.equal(starter.edges.length,2);
});

test('Boolean Algebra keeps cover semantics while hiding redundant relation labels',()=>{
  const algebra=generateBooleanAlgebra(3);
  assert.equal(algebra.edges.length,12);
  assert.ok(algebra.edges.every(edge=>edge.relationType==='cover'&&edge.label===''&&edge.visual.showLabel===false));
});

test('coordinate plane is the unified 2D/3D vector and plotting structure',()=>{
  const template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,'knowledge-1',{dimension:'3d',scale:48});
  instance.plotExpressions=[{id:'curve-1',source:PLOT_PRESETS.helix.source,color:'#2f7658'}];
  const definition=materializeInstanceDefinition(template,instance),scene=buildSceneGeometry(definition,instance);
  assert.equal(template.version,5);
  assert.ok(template.parameters.some(item=>item.id==='dimension'));
  assert.ok(scene.background.some(item=>item.className?.includes('coordinate-z-axis')));
  assert.ok(scene.background.some(item=>item.type==='path'&&item.className==='coordinate-curve'));
  const visible=libraryEntries({structureTemplates:BUILTIN_TEMPLATES});
  assert.ok(visible.some(item=>item.id==='builtin:coordinate-plane'));
  assert.ok(!visible.some(item=>item.id==='builtin:vector-space'));
});

test('Venn region cards reserve enough room for semantic title and Knowledge preview',()=>{
  const template=getBuiltinTemplate('builtin:venn-3'),instance=createStructureInstance(template,'knowledge-1'),scene=buildSceneGeometry(materializeTemplate(template),instance);
  assert.ok(scene.nodes.every(node=>node.width>=150&&node.height>=58));
});

test('binding metadata distinguishes a structural construction from a jump reference',()=>{
  const template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template,'root');
  const constructed=bindTarget(instance,template,'L1','knowledge','a',{placementMode:'construct'}),reference=bindTarget(instance,template,'L2','knowledge','a',{placementMode:'reference'});
  assert.equal(constructed.metadata.placementMode,'construct');
  assert.equal(reference.metadata.placementMode,'reference');
  assert.equal(instance.containers.L2.children[0].metadata.placementMode,'reference');
});

test('V4.2.2+ UI converges document editing, creation entry and inline source search',()=>{
  const html=fs.readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8'),controller=fs.readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8');
  assert.match(html,/V4\.3\.0(?: RC)?/);
  assert.match(html,/id="notesEditorHost"/);
  assert.doesNotMatch(html,/id="notesEditor"/);
  assert.match(html,/id="newTabPage"/);
  assert.match(html,/id="sourceSearchBar"/);
  assert.doesNotMatch(html,/id="newKnowledge"/);
  assert.doesNotMatch(html,/id="openLibrary"/);
  assert.match(controller,/itemType:'relation'/);
  assert.match(controller,/renderKnowledgeNotesEditor/);
  assert.match(controller,/构造知识（纳入导航）/);
  assert.match(controller,/引用知识（仅跳转）/);
  assert.doesNotMatch(controller,/\['bindings','引用'\]/);
});
