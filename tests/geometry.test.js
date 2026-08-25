import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorPoint,buildSceneGeometry,fitScene,routeEdge,screenToWorld,worldToScreen} from '../packages/geometry/scene-geometry.js';
import {getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';

test('world and screen transforms round trip at all semantic zoom levels',()=>{for(const zoom of[.25,.5,1,1.5,2.5]){const view={zoom,panX:137,panY:-44},world={x:321.25,y:189.75},screen=worldToScreen(world,view),roundTrip=screenToWorld(screen,view);assert.ok(Math.abs(roundTrip.x-world.x)<1e-9);assert.ok(Math.abs(roundTrip.y-world.y)<1e-9)}});

test('shape anchors land on boundaries without DOM measurement',()=>{const rect={x:100,y:100,width:200,height:100,shape:'rect'},circle={x:400,y:100,width:100,height:100,shape:'circle'};assert.deepEqual(anchorPoint(rect,{x:500,y:150}),{x:300,y:150});const point=anchorPoint(circle,{x:450,y:0});assert.equal(point.x,450);assert.equal(point.y,100)});

test('edge router supports straight, bezier, orthogonal and radial arc paths',()=>{const a={x:0,y:0,width:100,height:60,shape:'roundedRect'},b={x:300,y:180,width:100,height:60,shape:'roundedRect'};assert.match(routeEdge(a,b,'straight').path,/ L /);assert.match(routeEdge(a,b,'bezier').path,/ C /);assert.match(routeEdge(a,b,'orthogonal').path,/L/);assert.match(routeEdge(a,b,'radial-arc',{center:{x:200,y:120}}).path,/ A /)});

test('LMN layout and edges share stable world coordinates across viewport resize',()=>{const template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template),definition=materializeInstanceDefinition(template,instance),small=buildSceneGeometry(definition,instance,{viewport:{width:700,height:500}}),large=buildSceneGeometry(definition,instance,{viewport:{width:1500,height:900}});assert.deepEqual(small.nodes.map(node=>[node.id,node.x,node.y]),large.nodes.map(node=>[node.id,node.x,node.y]));assert.deepEqual(small.edges.map(edge=>edge.path),large.edges.map(edge=>edge.path));for(const edge of small.edges){assert.ok(Number.isFinite(edge.start.x));assert.ok(Number.isFinite(edge.end.y))}});

test('fit scene derives pan and zoom from world bounds',()=>{const template=getBuiltinTemplate('builtin:boolean-algebra'),instance=createStructureInstance(template,null,{rank:4}),scene=buildSceneGeometry(materializeTemplate(template,instance.parameters),instance),view=fitScene(scene,{width:1200,height:760});assert.ok(view.zoom>.1&&view.zoom<=2.5);assert.ok(Number.isFinite(view.panX));assert.ok(Number.isFinite(view.panY))});
