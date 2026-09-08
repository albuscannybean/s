import test from 'node:test';
import assert from 'node:assert/strict';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {anchorPoint,buildSceneGeometry,routeEdge} from '../packages/geometry/scene-geometry.js';

const center=n=>({x:n.x+n.width/2,y:n.y+n.height/2});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const sceneFor=(id,parameters={},configure=()=>{})=>{
  const template=getBuiltinTemplate(id),instance=createStructureInstance(template,null,parameters);configure(instance);
  return buildSceneGeometry(materializeInstanceDefinition(template,instance),instance);
};

test('Boolean lattice uses 4:3 bounds and complement-symmetric nodes and cover endpoints',()=>{
  for(let rank=1;rank<=6;rank++){
    const scene=sceneFor('builtin:boolean-algebra',{rank}),byValue=new Map(scene.nodes.map(n=>[n.semanticCoordinate.value,n]));
    const left=Math.min(...scene.nodes.map(n=>n.x)),right=Math.max(...scene.nodes.map(n=>n.x+n.width)),top=Math.min(...scene.nodes.map(n=>n.y)),bottom=Math.max(...scene.nodes.map(n=>n.y+n.height));
    near((right-left)/(bottom-top),4/3);
    const sum={x:left+right,y:top+bottom},mask=(1<<rank)-1;
    for(const node of scene.nodes){
      const complement=byValue.get(mask^node.semanticCoordinate.value),a=center(node),b=center(complement);
      near(a.x+b.x,sum.x);near(a.y+b.y,sum.y);near(node.width,complement.width);near(node.height,complement.height);
    }
    const byPair=new Map(scene.edges.map(e=>[[e.sourceSlotId,e.targetSlotId].join(':'),e]));
    for(const edge of scene.edges){
      const a=Number(edge.sourceSlotId.slice(1)),b=Number(edge.targetSlotId.slice(1)),dual=byPair.get(`b${mask^b}:b${mask^a}`);
      assert.ok(dual);near(edge.start.x+dual.end.x,sum.x);near(edge.start.y+dual.end.y,sum.y);
      near(edge.end.x+dual.start.x,sum.x);near(edge.end.y+dual.start.y,sum.y);
    }
  }
});

test('rounded node ports remain collinear, lie on their painted boundary, and reflect symmetrically',()=>{
  const node={id:'a',x:20,y:30,width:140,height:80,shape:'roundedRect',radius:18},c=center(node);
  for(const [dx,dy] of [[100,58],[100,100],[100,0],[0,100],[-100,58],[-100,-58]]){
    const p=anchorPoint(node,{x:c.x+dx,y:c.y+dy}),mirror=anchorPoint(node,{x:c.x-dx,y:c.y-dy});
    near((p.x-c.x)*dy,(p.y-c.y)*dx);near(p.x+mirror.x,2*c.x);near(p.y+mirror.y,2*c.y);
    const localX=Math.abs(p.x-c.x),localY=Math.abs(p.y-c.y);
    if(localX>52&&localY>22)near((localX-52)**2+(localY-22)**2,18**2);
    else assert.ok(Math.abs(localX-70)<1e-7||Math.abs(localY-40)<1e-7);
  }
  const target={...node,id:'b',x:330,y:212},edge=routeEdge(node,target);
  assert.deepEqual(edge.end,anchorPoint(target,c));
});

test('explicit global node size and radius survive specialized Boolean and radial layouts',()=>{
  const boolean=sceneFor('builtin:boolean-algebra',{rank:4},i=>{i.designStyles.nodeDefault={minWidth:180,maxWidth:180,minHeight:90,radius:20}});
  assert.ok(boolean.nodes.every(n=>n.width===180&&n.height>=90&&n.radius===20));
  const ring=sceneFor('builtin:mod-n',{},i=>{i.designStyles.nodeDefault={radius:4}});
  assert.ok(ring.nodes.every(n=>n.shape==='roundedRect'&&n.radius===4));
});
