import test from 'node:test';
import assert from 'node:assert/strict';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition,addInstanceSlot,addInstanceEdge,updateInstanceSlot,setNodePosition} from '../packages/structure-engine/model.js';
import {getStructureInteractionAdapter} from '../packages/structure-engine/interaction-adapters.js';
import {buildSceneGeometry,fitScene,projectCoordinate} from '../packages/geometry/scene-geometry.js';
const scene=(t,i,options={})=>buildSceneGeometry(getStructureInteractionAdapter(t).prepareDefinition(materializeInstanceDefinition(t,i)),i,options);
test('poset rank changes include manually connected elements and outrank stored drag coordinates',()=>{
 for(const id of ['builtin:lattice','builtin:poset-hasse']){
 const t=getBuiltinTemplate(id),i=createStructureInstance(t),d=materializeInstanceDefinition(t,i),a=d.slots.find(s=>s.label==='a'||s.label==='{a}'),b=d.slots.find(s=>s.label==='b'||s.label==='{b}');
 const e=addInstanceSlot(i,{label:'e5',role:'poset-element'});addInstanceEdge(i,a.id,e.id);addInstanceEdge(i,b.id,e.id);
 setNodePosition(i,e.id,{x:500,y:400});updateInstanceSlot(i,e.id,{semanticCoordinate:{preferredRank:5}});
 const result=scene(t,i),target=result.nodes.find(n=>n.id===e.id);
 assert.equal(target.semanticCoordinate.rank,5);assert.notEqual(target.y,400);assert.equal(result.edges.filter(e=>e.targetSlotId===target.id).length,2);
 updateInstanceSlot(i,e.id,{semanticCoordinate:{preferredRank:6}});assert.ok(scene(t,i).nodes.find(n=>n.id===e.id).y<target.y);
 for(const edge of result.edges)assert.ok(result.nodes.find(n=>n.id===edge.sourceSlotId).y>result.nodes.find(n=>n.id===edge.targetSlotId).y);
 updateInstanceSlot(i,a.id,{semanticCoordinate:{preferredRank:8}});const adjusted=scene(t,i);assert.ok(adjusted.nodes.find(n=>n.id===e.id).semanticCoordinate.rank>8);
 }
});
test('tree places parents left of vertically separated children and preserves dragged order',()=>{
 const t=getBuiltinTemplate('builtin:tree'),i=createStructureInstance(t);let result=scene(t,i),root=result.nodes.find(n=>n.id==='root'),left=result.nodes.find(n=>n.id==='left'),right=result.nodes.find(n=>n.id==='right');
 assert.ok(root.x+root.width<left.x);assert.ok(left.y+left.height<right.y);
 setNodePosition(i,'left',{x:left.x,y:right.y+right.height+60});result=scene(t,i);assert.ok(result.nodes.find(n=>n.id==='left').y>right.y);
 assert.deepEqual(result.edges.map(e=>[e.sourceSlotId,e.targetSlotId]),[['root','left'],['root','right']]);
});
test('coordinate observation projection controls rendering even with legacy dimension data',()=>{
 const t=getBuiltinTemplate('builtin:coordinate-plane'),i=createStructureInstance(t,{},{dimension:'2d'}),p={x:2,y:3,z:4};
 i.structureView.camera.projection='xOy';const plane=projectCoordinate(p,i);i.structureView.camera.projection='free';assert.notDeepEqual(projectCoordinate(p,i),plane);i.structureView.camera.projection='yOz';assert.notDeepEqual(projectCoordinate(p,i),plane);
});
test('auto-growing curves never expand the next fit bounds or push the camera away from origin',()=>{
 const t=getBuiltinTemplate('builtin:coordinate-plane'),i=createStructureInstance(t);i.plotExpressions=[{id:'quadratic',source:'y=x^2',rangeMode:'viewport'}];
 const viewport={width:1100,height:780};let view={zoom:.06,panX:-2200,panY:12000},previous=null;
 for(let n=0;n<8;n++){const result=scene(t,i,{zoom:view.zoom,worldViewport:{left:-view.panX/view.zoom,right:(viewport.width-view.panX)/view.zoom,top:-view.panY/view.zoom,bottom:(viewport.height-view.panY)/view.zoom}});view=fitScene(result,viewport);if(previous)assert.deepEqual(view,previous);previous=view;}
 assert.ok(view.zoom>.5);const origin=projectCoordinate({},i);assert.ok(Math.abs(origin.x*view.zoom+view.panX-viewport.width/2)<80);assert.ok(Math.abs(origin.y*view.zoom+view.panY-viewport.height/2)<80);
});
