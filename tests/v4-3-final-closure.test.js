import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';
import {getStructureInteractionAdapter} from '../packages/structure-engine/interaction-adapters.js';
import {importLkl,serializeLkl} from '../packages/lkl/index.js';

const source=path=>readFile(new URL(path,import.meta.url),'utf8');

test('Matrix / Grid is a real parameterized row-column structure',()=>{
  const template=getBuiltinTemplate('builtin:matrix-grid'),definition=materializeTemplate(template,{rows:4,columns:5,cellPrefix:'m'});
  assert.equal(definition.slots.length,20);
  assert.deepEqual(definition.slots.at(0).semanticCoordinate,{row:1,col:1,matrixIndex:0});
  assert.deepEqual(definition.slots.at(-1).semanticCoordinate,{row:4,col:5,matrixIndex:19});
  const instance=createStructureInstance(template,'knowledge:matrix',{rows:4,columns:5,cellPrefix:'m'}),materialized=materializeInstanceDefinition(template,instance),scene=buildSceneGeometry(materialized,instance);
  assert.equal(scene.nodes.length,20);
  assert.ok(scene.nodes.every(node=>node.visualKind==='matrix-cell'));
  assert.equal(scene.background.filter(item=>item.className==='matrix-bracket').length,2);
  assert.equal(scene.background.filter(item=>item.className==='matrix-axis-label').length,9);
});

test('coordinate points and vectors are display-only canvas objects',()=>{
  const template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,'knowledge:vector'),definition=materializeInstanceDefinition(template,instance),adapter=getStructureInteractionAdapter(template),point=definition.slots.find(slot=>slot.role==='point'),capabilities=adapter.getContainerCapabilities(point,instance,template);
  assert.equal(adapter.id,'coordinate');
  assert.equal(capabilities.canMoveVisualPosition,false);
  assert.equal(capabilities.canEditContent,false);
  assert.equal(capabilities.canAddKnowledge,false);
  assert.equal(capabilities.canAddStructure,false);
  assert.equal(capabilities.canAddLocalContent,false);
});

test('LKL 1 round-trips an arbitrary manually positioned custom structure',()=>{
  const template={id:'custom:lkl-ai-structure',name:'AI 高级结构 · AI Advanced Structure',description:'round trip',version:1,category:'custom',builtin:false,nestable:true,computable:false,slots:[{id:'a',label:'A',role:'source',semanticCoordinate:{order:0},accepts:['knowledge','structure'],cardinality:'many'},{id:'b',label:'B',role:'target',semanticCoordinate:{order:1},accepts:['knowledge'],cardinality:'many'}],edges:[{id:'ab',sourceSlotId:'a',targetSlotId:'b',direction:'bidirectional',relationType:'related',label:'联系',routing:'bezier'}],parameters:[],variables:[],constraints:[],rules:[],layout:{type:'manual',positions:{a:{x:120,y:80},b:{x:420,y:230}}},visual:{accent:'#596B63'}};
  const imported=importLkl(serializeLkl(template));
  assert.equal(imported.valid,true,imported.errors?.map(error=>error.message).join('\n'));
  assert.deepEqual(imported.definition.layout,template.layout);
  assert.equal(imported.definition.edges[0].direction,'bidirectional');
});

test('final RC UI keeps global locations and browser tabs while retiring boards',async()=>{
  const[controller,renderer,html,css]=await Promise.all([source('../packages/ui/workspace-controller.js'),source('../packages/ui/structure-renderer.js'),source('../apps/web/index.html'),source('../apps/web/styles.css')]);
  assert.match(controller,/rootKnowledgeObjects\(\)/);
  assert.match(controller,/moveNavigatorObject\(payload,targetInstanceId,targetSlotId\)/);
  assert.match(controller,/reassignStructureOwnership/);
  assert.match(controller,/bindNavigatorResizer/);
  assert.match(controller,/renderBrowserTabs\(\)/);
  assert.match(controller,/application\/x-lmn-tab/);
  assert.match(controller,/startMotionAnimation\(\)/);
  assert.match(renderer,/displayOnlyNodes/);
  assert.match(css,/\.navigator-resizer/);
  assert.match(css,/\.navigator-content\{overflow:auto/);
  assert.match(css,/\.display-only-node/);
  assert.doesNotMatch(controller,/createBoardForCurrent|renderBoardFrame|addTemplateToBoard/);
  assert.doesNotMatch(html,/id="boardWorkspace"/);
  assert.doesNotMatch(html,/data-new-tab-action="board"/);
  assert.doesNotMatch(html,/新建组合页面/);
});
