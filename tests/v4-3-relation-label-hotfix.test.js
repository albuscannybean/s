import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSceneGeometry,estimateRelationLabelWidth} from '../packages/geometry/scene-geometry.js';
import {pointAlongPolyline,relationLabelPlacement,relationPathPoints,semanticRelationLabelPlacement} from '../packages/ui/structure-renderer.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';

globalThis.localStorage??={getItem:()=>null,setItem:()=>{}};

const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const straightEdge=(visual={})=>({id:'edge',routing:'straight',start:{x:80,y:140},end:{x:440,y:140},points:[{x:80,y:140},{x:440,y:140}],visual});

test('straight and Chinese relation labels use the exact visible endpoint midpoint',()=>{
  for(const label of['relation','条件到自由']){
    const edge=straightEdge(),placement=semanticRelationLabelPlacement(edge,label);
    near(placement.x,(edge.start.x+edge.end.x)/2);near(placement.y,(edge.start.y+edge.end.y)/2);
    near(placement.bounds.x+placement.bounds.width/2,placement.x);near(placement.bounds.y+placement.bounds.height/2,placement.y);
    assert.equal(placement.strategy,'semantic-center');
  }
});

test('long labels enlarge the horizontal layered corridor without moving off the edge',()=>{
  const template=structuredClone(getBuiltinTemplate('builtin:dependency-dag')),label='作为自由得以成立的先验条件',instance=createStructureInstance(template,'root');instance.structureView.arrangement='horizontal-forward';template.edges[0].displayLabel=label;
  const scene=buildSceneGeometry(materializeInstanceDefinition(template,instance),instance),edge=scene.edges[0],placement=relationLabelPlacement(edge,scene,label),source=scene.nodes.find(node=>node.id===edge.sourceSlotId),target=scene.nodes.find(node=>node.id===edge.targetSlotId),left=source.x<target.x?source:target,right=left===source?target:source;
  assert.ok(right.x-(left.x+left.width)>=estimateRelationLabelWidth(label)+24);
  near(placement.x,(edge.start.x+edge.end.x)/2);near(placement.y,(edge.start.y+edge.end.y)/2);
});

test('every edge in a four-node auto-layout chain keeps its label at the exact midpoint',()=>{
  const labels=['条件到自由','自然的发展','差异与统一'],slots=['kant','fichte','schelling','hegel'].map((id,index)=>({id,label:id,role:'thinker',semanticCoordinate:{layer:3-index,order:0},accepts:['knowledge'],cardinality:'many'})),edges=labels.map((label,index)=>({id:`e${index}`,sourceSlotId:slots[index].id,targetSlotId:slots[index+1].id,direction:'directed',relationType:'develops',displayLabel:label,routing:'straight',visual:{labelPosition:'center'}})),template={id:'custom:four-thinkers',name:'Four thinkers',version:1,category:'custom',builtin:false,nestable:true,computable:false,slots,edges,parameters:[],variables:[],constraints:[],rules:[],layout:{type:'layered'},visual:{}},instance=createStructureInstance(template,'root');instance.structureView.arrangement='horizontal-forward';
  const scene=buildSceneGeometry(materializeInstanceDefinition(template,instance),instance);
  for(const edge of scene.edges){const placement=relationLabelPlacement(edge,scene,edge.displayLabel);near(placement.x,(edge.start.x+edge.end.x)/2);near(placement.y,(edge.start.y+edge.end.y)/2);assert.equal(placement.strategy,'semantic-center')}
});

test('orthogonal center uses the longest segment midpoint and Bezier center uses sampled arc length',()=>{
  const orthogonal={routing:'orthogonal',points:[{x:0,y:0},{x:220,y:0},{x:220,y:60},{x:300,y:60}],start:{x:0,y:0},end:{x:300,y:60},visual:{labelPosition:'center'}},orthogonalPlacement=semanticRelationLabelPlacement(orthogonal,'推出');near(orthogonalPlacement.x,110);near(orthogonalPlacement.y,0);
  const bezier={routing:'bezier',points:[{x:0,y:0},{x:20,y:260},{x:270,y:-30},{x:320,y:120}],start:{x:0,y:0},end:{x:320,y:120},visual:{labelPosition:'center'}},placement=semanticRelationLabelPlacement(bezier,'发展'),reference=pointAlongPolyline(relationPathPoints(bezier,512),.5);
  near(placement.x,reference.x,1.5);near(placement.y,reference.y,1.5);assert.ok(Math.hypot(placement.x-160,placement.y-60)>3,'Bezier label incorrectly used the endpoint midpoint');
});

test('explicit start/end semantics are stable and collision fallback is manual-only',()=>{
  const nodes=[{x:220,y:110,width:80,height:60}],manual={layout:'manual',nodes},automatic={layout:'layered',nodes};
  for(const[position,ratio]of[['start',.18],['end',.82]]){const edge=straightEdge({labelPosition:position}),expected=pointAlongPolyline(edge.points,ratio),placement=relationLabelPlacement(edge,manual,position);near(placement.x,expected.x);near(placement.y,expected.y);assert.equal(placement.strategy,`semantic-${position}`)}
  const centered=straightEdge({labelPosition:'center'}),autoPlacement=relationLabelPlacement(centered,automatic,'关系'),manualPlacement=relationLabelPlacement(centered,manual,'关系');near(autoPlacement.x,260);near(autoPlacement.y,140);assert.equal(autoPlacement.strategy,'semantic-center');assert.equal(manualPlacement.strategy,'manual-collision-fallback');assert.ok(manualPlacement.x!==260||manualPlacement.y!==140);
});

test('SVG text, background cutout, cache build key and product version preserve the hotfix contract',async()=>{
  const [renderer,styles,worker,manifest]=await Promise.all([readFile(new URL('../packages/ui/structure-renderer.js',import.meta.url),'utf8'),readFile(new URL('../apps/web/styles.css',import.meta.url),'utf8'),readFile(new URL('../apps/web/sw.js',import.meta.url),'utf8'),readFile(new URL('../package.json',import.meta.url),'utf8')]);
  assert.match(renderer,/setAttribute\('dominant-baseline','middle'\)/);assert.match(renderer,/setAttribute\('y',placement\.y\)/);assert.doesNotMatch(renderer,/setAttribute\('y',placement\.y\+4\)/);assert.match(styles,/\.edge-label-background\{fill:var\(--canvas\);stroke:var\(--canvas\)/);assert.match(worker,/lmn-v4\.3\.2-stable-20260905-1/);assert.equal(JSON.parse(manifest).version,'4.3.2');
});
