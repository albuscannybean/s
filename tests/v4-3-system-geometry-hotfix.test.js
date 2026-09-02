import test from 'node:test';
import assert from 'node:assert/strict';
import {navigatorStructureRoots,primaryStructureForKnowledge} from '../packages/navigation/navigator-model.js';
import {validateKnowledgePackage} from '../packages/lkl2/validator.js';
import {buildSceneGeometry,DEFAULT_NODE_SIZE} from '../packages/geometry/scene-geometry.js';
import {measureNodePresentation,semanticZoomDensity} from '../packages/geometry/node-measurement.js';
import {createGeometryPrimitive,evaluateGeometryPrimitive} from '../packages/geometry/geometry-primitives.js';
import {polygonArea2d,tetrahedronVolume,triangleArea3d} from '../packages/geometry/geometric-measurements.js';
import {createPrimitiveFromSelection} from '../packages/structure-engine/coordinate-operations.js';
import {exportV4Bundle,importV4Bundle} from '../packages/structure-engine/bundle.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';
import {listRegisteredVariables} from '../packages/domain/variable-registry.js';
import {nextObjectName,spreadsheetName} from '../packages/domain/naming-policy.js';

test('direct construct placements select a knowledge primary structure by order',()=>{
  const a={id:'structure-a',ownerKnowledgeId:'knowledge-k'},b={id:'structure-b',ownerKnowledgeId:'knowledge-k'},state={structureInstances:[a,b],placements:[{id:'late',targetType:'structure',targetId:a.id,parentType:'knowledge',parentId:'knowledge-k',mode:'construct',order:20},{id:'early',targetType:'structure',targetId:b.id,parentType:'knowledge',parentId:'knowledge-k',mode:'construct',order:1}]};
  assert.deepEqual(navigatorStructureRoots(state,'knowledge-k').map(item=>item.id),['structure-b','structure-a']);assert.equal(primaryStructureForKnowledge(state,'knowledge-k').id,'structure-b');
});

test('construct K to S to K cycles are diagnosed while references remain legal',()=>{
  const base={package:{stableId:'cycle-package',root:{type:'knowledge',id:'K'}},knowledge:[{stableId:'K',title:'K'}],contents:[],structureTemplates:[],structureInstances:[{stableId:'S',templateRef:'builtin:directed-graph',parameters:{},containers:[],variables:[]}],relations:[],variables:[],views:[],boards:[],entries:[],sources:[]};
  const cycle=validateKnowledgePackage({...base,placements:[{stableId:'p1',target:{type:'structure',id:'S'},parent:{type:'knowledge',id:'K'},mode:'construct',order:0,path:''},{stableId:'p2',target:{type:'knowledge',id:'K'},parent:{type:'structure',id:'S'},mode:'construct',order:0,path:'A'}]});assert.ok(cycle.diagnostics.some(item=>item.message.includes('Construct cycle detected')));
  const reference=validateKnowledgePackage({...base,placements:[{stableId:'p1',target:{type:'structure',id:'S'},parent:{type:'knowledge',id:'K'},mode:'construct',order:0,path:''},{stableId:'p2',target:{type:'knowledge',id:'K'},parent:{type:'structure',id:'S'},mode:'reference',order:0,path:'A'}]});assert.equal(reference.errors.some(item=>item.message.includes('Construct cycle detected')),false);
});

test('measured layered nodes wrap long titles and do not overlap',()=>{
  const long='这是一个会自动换行并扩大节点高度的非常长的知识结构标题',measurement=measureNodePresentation({label:long},{minimum:DEFAULT_NODE_SIZE});assert.ok(measurement.height>DEFAULT_NODE_SIZE.height);assert.ok(measurement.lines>=2);
  const definition={id:'custom:measured',layout:{type:'layered'},slots:[{id:'A',label:long,displayLabel:long,role:'premise',semanticCoordinate:{layer:1,order:0}},{id:'B',label:'短标题',role:'premise',semanticCoordinate:{layer:1,order:1}},{id:'C',label:'结论',role:'conclusion',semanticCoordinate:{layer:0,order:0}}],edges:[{id:'e',sourceSlotId:'A',targetSlotId:'C',label:'一段较长的关系文字',direction:'directed'}],visual:{}};
  const instance={id:'measured-instance',parameters:{},variables:[],runtimeState:{variables:{},results:{},errors:{}},bindings:[],containers:{},overrides:{addedSlots:[],removedSlotIds:[],addedEdges:[],removedEdgeIds:[],slotPatches:{},edgePatches:{}},layoutState:{visualOffsets:{},nodePositions:{},collapsedSlots:[]},designStyles:{nodeDefault:{autoSize:true,maxWidth:260,maxTitleLines:3}},relationStyles:{structureDefault:{},typeOverrides:{},edgeOverrides:{}},structureView:{arrangement:'vertical-reverse'}};
  const scene=buildSceneGeometry(definition,instance),a=scene.nodes.find(item=>item.id==='A'),b=scene.nodes.find(item=>item.id==='B');assert.ok(a.height>DEFAULT_NODE_SIZE.height);assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x);
  assert.equal(semanticZoomDensity(.2),'overview');assert.equal(semanticZoomDensity(.5),'compact');assert.equal(semanticZoomDensity(1),'normal');assert.equal(semanticZoomDensity(1.6),'detail');
});

test('geometry primitives remain independent from semantic edges and recompute dynamically',()=>{
  const instance={parameters:{dimension:'2d'},geometryPrimitives:[],motionPoints:[{id:'M1',plotId:'plot',current:1,start:0}],plotExpressions:[{id:'plot',source:'x=t'}]},definition={slots:[{id:'A',semanticCoordinate:{x:0,y:0,z:0}},{id:'B',semanticCoordinate:{x:4,y:0,z:0}},{id:'C',semanticCoordinate:{x:0,y:3,z:0}}],edges:[]};
  const line=createPrimitiveFromSelection(instance,'line',new Set(['slot:A','slot:B']));assert.equal(definition.edges.length,0);assert.equal(line.kind,'line');
  const dynamic=createGeometryPrimitive('line',[{type:'slot',id:'A'},{type:'motion',id:'M1'}]),evaluatePlotPoint=(_source,t)=>({x:t,y:t*2,z:0});assert.equal(evaluateGeometryPrimitive(dynamic,{instance,definition,evaluatePlotPoint}).value,Math.sqrt(5));instance.motionPoints[0].current=2;assert.equal(evaluateGeometryPrimitive(dynamic,{instance,definition,evaluatePlotPoint}).value,Math.sqrt(20));
  assert.equal(polygonArea2d([{x:0,y:0},{x:4,y:0},{x:0,y:3}]),6);assert.equal(triangleArea3d([{x:0,y:0,z:0},{x:4,y:0,z:0},{x:0,y:3,z:0}]),6);assert.equal(tetrahedronVolume([{x:0,y:0,z:0},{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}]),1/6);
  const coordinateTemplate=BUILTIN_TEMPLATES.find(item=>item.id==='builtin:coordinate-plane'),state={knowledge:[],relations:[],representations:[],structureTemplates:[coordinateTemplate],structureInstances:[{id:'coordinate',templateId:coordinateTemplate.id,...instance}],variableSchemes:[],knowledgePackages:[],contentObjects:[],structureViews:[],boards:[],placements:[],settings:[]},restored=importV4Bundle(exportV4Bundle(state),{knowledge:[],relations:[],structureTemplates:[],structureInstances:[]});assert.equal(restored.valid,true);assert.equal(restored.state.structureInstances[0].geometryPrimitives.length,1);
});

test('unified variable registry includes every coordinate object family',()=>{
  const definition={slots:[{id:'P',label:'P',role:'point',semanticCoordinate:{x:1,y:2,z:0}},{id:'V',label:'v₁',role:'vector-end',semanticCoordinate:{x:2,y:0,z:0}}]},instance={variables:[{id:'x',label:'x',kind:'input',value:1}],runtimeState:{variables:{x:1},results:{}},plotExpressions:[{id:'C',label:'C₁',source:'y=x'}],motionPoints:[{id:'M',label:'M1',current:0}],geometryPrimitives:[{id:'G',kind:'line',pointRefs:[{type:'slot',id:'P'},{type:'slot',id:'V'}]}],objectVisibility:{},overrides:{slotPatches:{},removedSlotIds:[]},parameters:{dimension:'2d'}};
  const kinds=new Set(listRegisteredVariables({},instance,definition,{evaluatePlotPoint:()=>({x:0,y:0})}).map(item=>item.kind));assert.deepEqual(kinds,new Set(['variable','point','vector','plot','motion','geometry']));
});

test('naming policy separates stable ids and collision-free display names',()=>{
  assert.equal(spreadsheetName(25),'Z');assert.equal(spreadsheetName(26),'AA');const definition={slots:[{label:'A'},{label:'B'}]},point=nextObjectName({kind:'point',instance:{},definition});assert.equal(point.displayName,'C');assert.notEqual(point.id,point.displayName);const vector=nextObjectName({kind:'vector',instance:{overrides:{addedSlots:[{role:'vector-end',label:'v₁'}]}},definition:{slots:[{label:'v₁'}]}});assert.equal(vector.displayName,'v₂');assert.equal(nextObjectName({kind:'line'}).displayName,'');
});
