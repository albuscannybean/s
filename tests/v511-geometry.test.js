import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_TEMPLATES,getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';
import {buildTemplatePreviewScene} from '../packages/ui/template-preview.js';
import {analyzePoset,parseRelationText} from '../packages/structure-engine/poset.js';
import {setRelationStyle} from '../packages/structure-engine/relation-style-resolver.js';

test('every installed builtin can be materialized and previewed with finite geometry',()=>{
 for(const template of BUILTIN_TEMPLATES){
  const result=buildTemplatePreviewScene(template),scene=result.scene;
  assert.ok(Object.values(scene.bounds).every(Number.isFinite),template.id);
  assert.equal(scene.nodes.length,result.definition.slots.length,template.id);
  assert.equal(scene.edges.length,result.definition.edges.length,template.id);
  assert.ok(scene.edges.every(e=>!/(NaN|Infinity)/.test(e.path)),template.id);
  if(!['builtin:empty-custom'].includes(template.id))assert.ok(scene.nodes.length>0,template.id);
 }
});
test('Boolean Hasse covers stay straight without unrelated outer bus lines',()=>{
 const t=getBuiltinTemplate('builtin:boolean-algebra'),i=createStructureInstance(t,null,{rank:4});
 const result=buildSceneGeometry(materializeInstanceDefinition(t,i),i);
 assert.equal(result.nodes.length,16);assert.equal(result.edges.length,32);
 assert.ok(result.edges.every(e=>e.routing==='straight'&&e.points.length===2&&!/[CA]/.test(e.path)));
 const minY=Math.min(...result.nodes.map(n=>n.y)),maxY=Math.max(...result.nodes.map(n=>n.y+n.height));
 assert.ok(result.edges.every(e=>e.points.every(p=>p.y>=minY&&p.y<=maxY)));
});
test('ring routes preserve arcs and style edits take effect without changing semantic incidence',()=>{
 for(const id of ['builtin:mod-n','builtin:cyclic-group']){
  const t=getBuiltinTemplate(id),i=createStructureInstance(t),definition=materializeInstanceDefinition(t,i),before=definition.edges.map(e=>[e.id,e.sourceSlotId,e.targetSlotId]);
  let scene=buildSceneGeometry(definition,i);
  if(id==='builtin:mod-n')assert.ok(scene.edges.every(e=>e.routing==='radial-arc'&&e.path.includes(' A ')),id);
  for(const routing of ['straight','bezier','orthogonal','radial-arc']){
   setRelationStyle(i,{scope:'all'},{routing});scene=buildSceneGeometry(definition,i);
   assert.ok(scene.edges.every(e=>e.routing===routing),routing);
   assert.deepEqual(scene.edges.map(e=>[e.id,e.sourceSlotId,e.targetSlotId]),before);
  }
 }
});
test('invalid parameters fail visibly; explicit blank remains valid and starter choices work',()=>{
 const t=getBuiltinTemplate('builtin:poset-hasse');
 assert.equal(buildTemplatePreviewScene(t).scene.nodes.length,4);
 assert.equal(buildTemplatePreviewScene(t,{starter:'blank'}).scene.nodes.length,0);
 assert.equal(buildTemplatePreviewScene(t,{starter:'relation-text',relationText:'a < b < c'}).scene.nodes.length,3);
 assert.throws(()=>buildTemplatePreviewScene(getBuiltinTemplate('builtin:boolean-algebra'),{rank:99}));
 assert.throws(()=>buildTemplatePreviewScene(t,{starter:'unknown'}));
});

test('explicit library defaults affect new instances and their shared preview without changing existing instances',()=>{
 const t=structuredClone(getBuiltinTemplate('builtin:mod-n')),existing=createStructureInstance(t);
 t.visual.relationStyleOverrides={routing:'bezier',color:'#123456'};
 const preview=buildTemplatePreviewScene(t),created=createStructureInstance(t);
 assert.ok(preview.scene.edges.every(e=>e.routing==='bezier'&&e.visual.color==='#123456'));
 assert.ok(buildSceneGeometry(materializeInstanceDefinition(t,created),created).edges.every(e=>e.routing==='bezier'));
 assert.ok(buildSceneGeometry(materializeInstanceDefinition(t,existing),existing).edges.every(e=>e.routing==='radial-arc'));
});
test('a relation graph entering a cycle terminates and reports its invalid order',()=>{
 const definition=parseRelationText('root < a; a < b; b < a'),result=analyzePoset(definition.slots,definition.edges);
 assert.equal(result.valid,false);assert.ok(result.cycle.length);
 assert.throws(()=>buildTemplatePreviewScene(getBuiltinTemplate('builtin:poset-hasse'),{starter:'relation-text',relationText:'root < a; a < b; b < a'}));
});
