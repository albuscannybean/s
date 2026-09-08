import test from 'node:test';
import assert from 'node:assert/strict';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition,addInstanceEdge,updateInstanceEdge} from '../packages/structure-engine/model.js';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';
import {segmentIntersectsNode} from '../packages/geometry/relation-routing.js';
import {relationPathPoints,relationLabelLines,semanticRelationLabelPlacement,chooseRelationLabelPlacement,boundsIntersect} from '../packages/ui/structure-renderer.js';
const fixture=(edges,positions={a:{x:100,y:150},b:{x:900,y:150}})=>({id:'custom:route-test',version:1,name:'Routing',parameters:[],slots:Object.keys(positions).map(id=>({id,label:id,role:'node',accepts:['knowledge'],cardinality:'many',semanticCoordinate:{}})),edges,layout:{type:'manual',positions},visual:{}});
const edge=(id,from,to,label=id)=>({id,sourceSlotId:from,targetSlotId:to,direction:'directed',relationType:'related',label,routing:'straight'});
const scene=t=>{const instance=createStructureInstance(t,'owner');return buildSceneGeometry(materializeInstanceDefinition(t,instance),instance)};
test('parallel and reverse relations keep independent routes, labels and IDs',()=>{
 const result=scene(fixture([edge('e1','a','b'),edge('e2','a','b'),edge('e3','b','a')]));
 assert.equal(new Set(result.edges.map(e=>e.id)).size,3);
 assert.equal(new Set(result.edges.map(e=>e.path)).size,3);
 const centers=result.edges.map(e=>semanticRelationLabelPlacement(e,e.label));
 for(let i=0;i<centers.length;i++)for(let j=i+1;j<centers.length;j++)assert.ok(Math.hypot(centers[i].x-centers[j].x,centers[i].y-centers[j].y)>25);
});
test('label avoidance preserves the requested straight route and complete text',()=>{
 const result=scene(fixture([edge('e','a','b','条件关系：只在给定的定义域与假设成立时推出结论')],{a:{x:80,y:200},c:{x:450,y:200},b:{x:950,y:200}}));
 const link=result.edges[0],obstacle=result.nodes.find(n=>n.id==='c'),points=relationPathPoints(link);
 assert.equal(link.routing,'straight');
 assert.equal(points.length,2);
 const placement=chooseRelationLabelPlacement(link,result.nodes,link.label);
 assert.ok(!boundsIntersect(placement.bounds,obstacle));
 assert.equal(link.label,'条件关系：只在给定的定义域与假设成立时推出结论');
});
test('parallel self-relations get separate loops within scene bounds',()=>{
 const result=scene(fixture([edge('a1','a','a'),edge('a2','a','a')]));
 assert.notEqual(result.edges[0].path,result.edges[1].path);
 for(const e of result.edges)for(const p of e.points)assert.ok(p.y>=result.bounds.y&&p.y<=result.bounds.y+result.bounds.height);
});
test('long labels wrap without truncation',()=>{
 const label='在全部必要条件成立时才能进行逐项积分和求导，并且必须检验定义域与边界情况。'.repeat(4);
 const lines=relationLabelLines(label);assert.ok(lines.length>1);assert.equal(lines.join(''),label);
});
test('Boolean lattice is wider than tall and distinct nodes do not overlap',()=>{
 const t=getBuiltinTemplate('builtin:boolean-algebra'),i=createStructureInstance(t,'owner',{rank:4}),r=buildSceneGeometry(materializeInstanceDefinition(t,i),i),width=Math.max(...r.nodes.map(n=>n.x+n.width))-Math.min(...r.nodes.map(n=>n.x)),height=Math.max(...r.nodes.map(n=>n.y+n.height))-Math.min(...r.nodes.map(n=>n.y));
 assert.ok(Math.abs(width/height-4/3)<1e-9,JSON.stringify({width,height}));
 for(const a of r.nodes)for(const b of r.nodes)if(a!==b)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
});
test('editing a relation does not rename another relation of the same type',()=>{
 const t=fixture([edge('e1','a','b','关系 1')]),i=createStructureInstance(t,'owner'),second=addInstanceEdge(i,'a','b',{label:'关系 2'},{definition:materializeInstanceDefinition(t,i)});
 updateInstanceEdge(i,second.id,{displayLabel:'独立编辑'});
 const d=materializeInstanceDefinition(t,i);assert.equal(d.edges.find(e=>e.id==='e1').label,'关系 1');assert.equal(d.edges.find(e=>e.id===second.id).displayLabel,'独立编辑');
});

