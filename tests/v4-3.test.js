import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {addInstanceEdge,createStructureInstance,materializeInstanceDefinition,removeInstanceEdge} from '../packages/structure-engine/model.js';
import {edgeCapabilities} from '../packages/structure-engine/interaction-adapters.js';
import {resolveRelationStyle,setRelationStyle} from '../packages/structure-engine/relation-style-resolver.js';
import {buildSceneGeometry,projectCoordinate} from '../packages/geometry/scene-geometry.js';
import {setStructureArrangement} from '../packages/structure-engine/structure-view.js';
import {parseStructureInstanceSource,serializeStructureInstance} from '../packages/lkl2/index.js';
import {posetStarterRelationText,serializePosetRelationText} from '../packages/structure-engine/poset.js';

test('V4.3 LMN feedback directions and polygon arrows carry the requested semantics',()=>{
  const lmn=getBuiltinTemplate('builtin:lmn-432');
  assert.deepEqual(lmn.edges.filter(edge=>['e8','e10'].includes(edge.id)).map(edge=>[edge.sourceSlotId,edge.targetSlotId]),[['N1','M2'],['N2','M3']]);
  const polygon=getBuiltinTemplate('builtin:regular-polygon'),instance=createStructureInstance(polygon,'knowledge',{n:5}),definition=materializeInstanceDefinition(polygon,instance);
  assert.equal(definition.edges.length,5);
  assert.ok(definition.edges.every(edge=>edge.direction==='directed'));
});

test('global Design overrides template and edge visuals, including bidirectional arrows and routing',()=>{
  const template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template,'knowledge'),edge={...template.edges[0],routing:'orthogonal',visual:{color:'#ff0000',width:7,routing:'straight',arrow:'none'}};
  setRelationStyle(instance,{scope:'all'},{color:'#123456',width:2.5,routing:'bezier',arrow:'both',labelPosition:'center'});
  const style=resolveRelationStyle(edge,instance,{structureDefault:{color:'#999999',width:6,routing:'orthogonal'}});
  assert.deepEqual({color:style.color,width:style.width,routing:style.routing,arrow:style.arrow,labelPosition:style.labelPosition},{color:'#123456',width:2.5,routing:'bezier',arrow:'both',labelPosition:'center'});
  const scene=buildSceneGeometry(materializeInstanceDefinition(template,instance),instance);
  assert.ok(scene.edges.every(value=>value.visual.arrow==='both'&&value.visual.routing==='bezier'));
});

test('LMN custom relations are editable and deletable without creating a canonical tombstone',()=>{
  const template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template,'knowledge'),edge=addInstanceEdge(instance,'L3','M1',{id:'custom-l3-m1',label:'自建关系',visual:{color:'#abcdef'}});
  const capabilities=edgeCapabilities(template,edge,instance);
  assert.equal(capabilities.canDeleteCanonicalObject,true);
  assert.equal(capabilities.canChangeDirection,true);
  instance.relationStyles.edgeOverrides[edge.id]={width:4};
  removeInstanceEdge(instance,edge.id);
  assert.equal(instance.overrides.addedEdges.some(value=>value.id===edge.id),false);
  assert.equal(instance.overrides.removedEdgeIds.includes(edge.id),false);
  assert.equal(instance.overrides.edgePatches[edge.id],undefined);
  assert.equal(instance.relationStyles.edgeOverrides[edge.id],undefined);
});

test('vector space supports conventional plane projections, visibility and viewport-wide sampling',()=>{
  const template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,'knowledge',{dimension:'3d',scale:40}),coordinate={x:2,y:3,z:4};
  instance.structureView.camera.projection='xOy';assert.deepEqual(projectCoordinate(coordinate,instance),{x:580,y:240});
  instance.structureView.camera.projection='yOz';assert.deepEqual(projectCoordinate(coordinate,instance),{x:620,y:200});
  instance.structureView.camera.projection='xOz';assert.deepEqual(projectCoordinate(coordinate,instance),{x:580,y:200});
  instance.structureView.camera={projection:'free',yaw:42,pitch:28};assert.notDeepEqual(projectCoordinate(coordinate,instance),{x:580,y:200});
  instance.plotExpressions=[{id:'wide',label:'wide',source:'y=sin(x)',rangeMode:'viewport'},{id:'hidden',label:'hidden',source:'circle(cx=0, cy=0, r=2)',rangeMode:'viewport'}];
  instance.objectVisibility['plot:hidden']=false;instance.objectVisibility['slot:Q']=false;instance.structureView.camera.projection='xOy';
  const scene=buildSceneGeometry(materializeInstanceDefinition(template,instance),instance,{worldViewport:{left:-500,right:1500,top:-200,bottom:920},zoom:.5}),wide=scene.background.find(value=>value.plotId==='wide');
  assert.ok(wide?.d.includes('-500.00')||wide?.d.includes('-5'));
  assert.equal(scene.background.some(value=>value.plotId==='hidden'),false);
  assert.equal(scene.nodes.some(value=>value.id==='Q'),false);
  assert.ok(scene.background.filter(value=>value.className?.includes('coordinate-tick-label')).length>8);
});

test('horizontal Poset places smaller elements left and relation text round-trips starter semantics',()=>{
  const template=getBuiltinTemplate('builtin:poset-hasse'),instance=createStructureInstance(template,'knowledge',{starter:'numeric'});
  assert.equal(instance.parameters.relationText,posetStarterRelationText('numeric'));
  setStructureArrangement(instance,template,'horizontal');
  const definition=materializeInstanceDefinition(template,instance),scene=buildSceneGeometry(definition,instance),byId=new Map(scene.nodes.map(node=>[node.id,node]));
  assert.ok(byId.get('n0').x<byId.get('n1').x&&byId.get('n1').x<byId.get('n2').x&&byId.get('n2').x<byId.get('n3').x);
  assert.equal(serializePosetRelationText(definition.slots,definition.edges),'0 < 1\n1 < 2\n2 < 3');
});

test('LKL persists camera, visibility, plots and global relation direction styling',()=>{
  const template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,'knowledge',{dimension:'3d'});
  instance.structureView.camera={projection:'yOz',yaw:61,pitch:17};instance.objectVisibility={'slot:Q':false,'plot:p':false};instance.plotExpressions=[{id:'p',source:'paraboloid(a=.2)',rangeMode:'viewport'}];instance.relationStyles.structureDefault={color:'#345678',width:3,routing:'straight',arrow:'both'};
  const source=serializeStructureInstance(template,instance),parsed=parseStructureInstanceSource(source,{template,instance});
  assert.equal(parsed.valid,true,parsed.diagnostics[0]?.message);
  assert.match(source,/object-visibility/);
  assert.deepEqual(parsed.draft.structureView.camera,{projection:'yOz',yaw:61,pitch:17});
  assert.equal(parsed.draft.objectVisibility['slot:Q'],false);
  assert.equal(parsed.draft.plotExpressions[0].rangeMode,'viewport');
  assert.equal(parsed.draft.relationStyles.structureDefault.arrow,'both');
});

test('V4.3 UI exposes tracked libraries, three search modes, command-only top bar and unified operations',()=>{
  const controller=fs.readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../apps/web/styles.css',import.meta.url),'utf8');
  assert.match(html,/V4\.3\.0(?: RC)?/);assert.match(html,/id="searchWorkbench"/);assert.match(html,/>命令行</);assert.match(html,/id="insertStructure" class="primary hidden"/);
  for(const label of['结构检索','全文检索','LKL 检索','＋ 新建结构','操作','代数','几何'])assert.match(controller,new RegExp(label));
  assert.match(controller,/nav-other-knowledge/);assert.match(controller,/renderNavigatorSlot/);assert.match(controller,/objectVisibility/);assert.match(controller,/camera\.projection/);
  assert.match(css,/\.document-tab\.add[^}]*border-radius:50%/);assert.match(css,/\.navigator-modes[^}]*repeat\(3,1fr\)/);assert.match(css,/\.coordinate-variable-manager/);assert.match(css,/\.search-workbench/);
});
