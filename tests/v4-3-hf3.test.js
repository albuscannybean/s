import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildSceneGeometry,requiredRelationCorridor} from '../packages/geometry/scene-geometry.js';
import {importKnowledgePackage,serializeKnowledgePackage,semanticEquivalent,buildImportPlan} from '../packages/lkl2/index.js';
import {applyStructureInstanceDraft,parseStructureInstanceSource,serializeStructureInstance} from '../packages/lkl2/structure-source.js';
import {createStructureInstance} from '../packages/structure-engine/model.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {createTabSession,currentTabLocation,moveTabHistory,pushTabLocation,tabCanMove} from '../packages/navigation/tab-session.js';

test('HF3 reserves each same-layer relation corridor from its real label',()=>{
  const labels=['康德的先验统觉如何通向费希特的自我设定','费希特知识学向谢林同一哲学的过渡','谢林自然哲学与黑格尔绝对精神的关系'];
  const slots=['kant','fichte','schelling','hegel'].map((id,order)=>({id,label:id,role:'philosopher',semanticCoordinate:{layer:1,order}}));
  const edges=labels.map((label,index)=>({id:`e${index}`,sourceSlotId:slots[index].id,targetSlotId:slots[index+1].id,direction:'directed',relationType:'development',label,routing:'straight'}));
  const scene=buildSceneGeometry({id:'german-idealism',layout:{type:'layered'},slots,edges},{id:'i',designStyles:{layout:{autoSpacing:true}},structureView:{arrangement:'vertical-forward'},layoutState:{visualOffsets:{},nodePositions:{}},objectVisibility:{}});
  const nodes=new Map(scene.nodes.map(node=>[node.id,node]));
  for(const edge of edges){const left=nodes.get(edge.sourceSlotId),right=nodes.get(edge.targetSlotId),gap=right.x-(left.x+left.width);assert.ok(gap>=requiredRelationCorridor(edge)-.01,`${edge.id}: ${gap}`)}
});

test('LKL 2.1 geometry survives parse, validation, serialization and import',()=>{
  const source=`lkl 2
package geometry-demo {
  id "geometry-demo"
  title "Geometry"
  version "1.0"
  root knowledge root
}
knowledge root {
  title "Root"
}
structure-instance plane {
  using builtin:coordinate-plane
  owner root
  runtime "{\\"motionPoints\\":[{\\"id\\":\\"M1\\"}]}"
  geometry g-line-1 {
    type "line"
    point slot origin
    point motion M1
    visible true
    stroke "#355f78"
    width 2
  }
}`;
  const parsed=importKnowledgePackage(source,{templates:BUILTIN_TEMPLATES});assert.equal(parsed.valid,true,JSON.stringify(parsed.diagnostics));assert.equal(parsed.package.structureInstances[0].geometries[0].pointRefs[1].type,'motion');
  const reparsed=importKnowledgePackage(serializeKnowledgePackage(parsed.package),{templates:BUILTIN_TEMPLATES});assert.equal(reparsed.valid,true,JSON.stringify(reparsed.diagnostics));assert.equal(semanticEquivalent(parsed.package,reparsed.package),true);
  const plan=buildImportPlan(parsed.package,{knowledge:[],relations:[],structureTemplates:structuredClone(BUILTIN_TEMPLATES),structureInstances:[]},{strict:true});assert.equal(plan.committable,true);assert.equal(plan.nextState.structureInstances[0].geometryPrimitives[0].id,'g-line-1');
});

test('structure source preserves geometry after resolving motion points',()=>{
  const template=BUILTIN_TEMPLATES.find(item=>item.id==='builtin:coordinate-plane'),instance=createStructureInstance(template,'root',{dimension:'2d'});
  instance.motionPoints=[{id:'M1',label:'M1',position:{x:1,y:2,z:0}}];
  instance.geometryPrimitives=[{id:'g-source-line',kind:'line',pointRefs:[{type:'slot',id:'origin'},{type:'motion',id:'M1'}],visible:true,style:{color:'#355f78',width:2,fill:'rgba(53,95,120,.14)'}}];
  const parsed=parseStructureInstanceSource(serializeStructureInstance(template,instance),{template,instance});
  assert.equal(parsed.valid,true,JSON.stringify(parsed.diagnostics));
  const applied=createStructureInstance(template,'root',{dimension:'2d'});applyStructureInstanceDraft(applied,parsed.draft);
  assert.deepEqual(applied.geometryPrimitives,instance.geometryPrimitives);
});

test('each browser tab owns an isolated navigation stack',()=>{
  const a=createTabSession({key:'a',id:'A'}),b=createTabSession({key:'b',id:'B'});pushTabLocation(a,{document:'A1'});pushTabLocation(a,{document:'A2'});pushTabLocation(b,{document:'B1'});pushTabLocation(b,{document:'B2'});assert.equal(moveTabHistory(a,-1).document,'A1');assert.equal(currentTabLocation(b).document,'B2');assert.equal(tabCanMove(a,1),true);assert.equal(tabCanMove(b,-1),true);
});

test('coordinate renderer exposes direct geometry hit targets without semantic connectors',async()=>{
  const renderer=await fs.readFile(new URL('../packages/ui/structure-renderer.js',import.meta.url),'utf8'),controller=await fs.readFile(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8');assert.match(renderer,/dataset\.geometryRefType/);assert.match(renderer,/onGeometryPointerDown/);assert.match(controller,/beginGeometryConnectionGesture/);assert.match(controller,/geometry:line-drag/);assert.match(controller,/createGeometryPrimitive\('line'/);
});

test('HF4 keeps the public version and advances only hotfix/cache metadata',async()=>{
  const metadata=await fs.readFile(new URL('../packages/app-metadata.js',import.meta.url),'utf8'),sw=await fs.readFile(new URL('../apps/web/sw.js',import.meta.url),'utf8');assert.match(metadata,/APP_VERSION='4\.3\.1'/);assert.match(metadata,/APP_HOTFIX='V4\.3\.1'/);assert.match(sw,/lmn-v4\.3\.1-stable-20260904-1/);assert.match(sw,/navigation\/tab-session\.js/);
});
