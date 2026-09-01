import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeDocumentId,parseDocumentId} from '../packages/navigation/document-id.js';
import {buildSceneGeometry,estimateRelationLabelWidth} from '../packages/geometry/scene-geometry.js';
import {boundsIntersect,chooseRelationLabelPlacement} from '../packages/ui/structure-renderer.js';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {addContainerContent} from '../packages/domain/semantic-container.js';

globalThis.localStorage??={getItem:()=>null,setItem:()=>{}};

test('Document Route Codec round-trips every audited route with reserved and Unicode IDs',()=>{
  const cases=[
    ['structure',['lkl2:structure-instance:德国/观念 论']],
    ['source',['lkl2:structure-instance:德国/观念 论']],
    ['container',['lkl2:structure-instance:德国/观念 论','主干:著作 / A']],
    ['content',['lkl2:structure-instance:德国/观念 论','主干:著作 / A','知识:1 / 空 格']],
    ['content-edit',['lkl2:structure-instance:德国/观念 论','主干:著作 / A','知识:1 / 空 格']],
    ['content-draft',['lkl2:structure-instance:德国/观念 论','主干:著作 / A','草稿:一']],
    ['relation',['lkl2:structure-instance:德国/观念 论','edge:条件 / 自由']],
    ['relation-edit',['lkl2:structure-instance:德国/观念 论','edge:条件 / 自由']]
  ];
  for(const[kind,parts]of cases){const id=makeDocumentId(kind,...parts),parsed=parseDocumentId(id);assert.equal(parsed.valid,true,id);assert.equal(parsed.kind,kind);assert.deepEqual(parsed.parts,parts);assert.equal(id.split(':').length,parts.length+1)}
});

test('colon-bearing LKL2 instance opens a two-item Container and legacy tabs are recovered',async()=>{
  const {WorkspaceController}=await import('../packages/ui/workspace-controller.js'),template=structuredClone(getBuiltinTemplate('builtin:dependency-dag')),instance=createStructureInstance(template,'knowledge:root'),definition=materializeInstanceDefinition(template,instance),slot=definition.slots[0];instance.id='lkl2:structure-instance:kant-shelling';
  addContainerContent(instance,slot.id,{id:'work:one',type:'content',content:{title:'《先验唯心论体系》'}},definition);
  addContainerContent(instance,slot.id,{id:'work:two',type:'content',content:{title:'《自由论》'}},definition);
  const controller=new WorkspaceController();controller.state={...controller.state,knowledge:[{id:'knowledge:root',title:'德国观念论'}],structureTemplates:[template],structureInstances:[instance]};controller.currentKnowledgeId='knowledge:root';controller.currentInstanceId=instance.id;
  controller.document=makeDocumentId('container',instance.id,slot.id);const context=controller.containerContext();assert.equal(context.instance.id,instance.id);assert.equal(context.slot.id,slot.id);assert.equal(context.entry.persistentChildren.length,2);
  const legacy=`container:${instance.id}:${slot.id}`,recovered=controller.documentRoute(legacy);assert.equal(recovered.valid,true);assert.equal(recovered.legacy,true);assert.deepEqual(recovered.parts,[instance.id,slot.id]);assert.equal(controller.canonicalDocumentId(legacy),controller.document);
  controller.rememberDocument=()=>{};controller.ensureSlotPath=()=>{};controller.pushLocation=()=>{};controller.closePanel=()=>{};controller.renderAll=()=>{};controller.openContainer(slot.id);assert.equal(controller.document,makeDocumentId('container',instance.id,slot.id));
});

test('controller resolves content and relation contexts whose IDs contain separators',async()=>{
  const {WorkspaceController}=await import('../packages/ui/workspace-controller.js'),template=structuredClone(getBuiltinTemplate('builtin:dependency-dag'));template.id='custom:哲学 / DAG';template.edges[0].id='edge:作为自由的先验条件 / A';const instance=createStructureInstance(template,'knowledge:root'),definition=materializeInstanceDefinition(template,instance),slot=definition.slots[0],itemId='content:批判 / 空 格';instance.id='lkl2:structure-instance:route-context';addContainerContent(instance,slot.id,{id:itemId,type:'content',content:{title:'批判哲学的起点'}},definition);
  const controller=new WorkspaceController();controller.state={...controller.state,knowledge:[{id:'knowledge:root',title:'德国观念论'}],structureTemplates:[template],structureInstances:[instance]};controller.currentInstanceId=instance.id;
  controller.document=makeDocumentId('content-edit',instance.id,slot.id,itemId);const content=controller.contentDocumentContext();assert.equal(content.item.id,itemId);assert.equal(content.isEditing,true);
  controller.document=makeDocumentId('relation-edit',instance.id,template.edges[0].id);const relation=controller.relationDocumentContext();assert.equal(relation.edge.id,template.edges[0].id);assert.equal(relation.isEditing,true);
});

test('horizontal layered cards keep readable dimensions and reserve a relation-label corridor',()=>{
  const template=structuredClone(getBuiltinTemplate('builtin:dependency-dag')),instance=createStructureInstance(template,'root');instance.structureView.arrangement='horizontal-forward';template.edges[0].displayLabel='作为自由的先验条件';const definition=materializeInstanceDefinition(template,instance),scene=buildSceneGeometry(definition,instance);
  for(const node of scene.nodes){assert.ok(node.width>=176,`${node.id} width ${node.width}`);assert.ok(node.height>=86,`${node.id} height ${node.height}`)}
  const edge=scene.edges.find(item=>item.id===template.edges[0].id),source=scene.nodes.find(item=>item.id===edge.sourceSlotId),target=scene.nodes.find(item=>item.id===edge.targetSlotId),left=source.x<target.x?source:target,right=left===source?target:source,gap=right.x-(left.x+left.width);assert.ok(gap>=estimateRelationLabelWidth(edge.displayLabel)+24,`corridor ${gap}`);
  const placement=chooseRelationLabelPlacement(edge,scene.nodes,edge.displayLabel);for(const node of scene.nodes)assert.equal(boundsIntersect(placement.bounds,{x:node.x,y:node.y,width:node.width,height:node.height}),false,node.id);
});

test('axis changes transform centers without rotating card dimensions and special geometries stay specialized',()=>{
  const template=getBuiltinTemplate('builtin:proof-tree'),vertical=createStructureInstance(template,'root'),horizontal=createStructureInstance(template,'root');vertical.structureView.arrangement='vertical-reverse';horizontal.structureView.arrangement='horizontal-forward';const definition=materializeInstanceDefinition(template,vertical),verticalScene=buildSceneGeometry(definition,vertical),horizontalScene=buildSceneGeometry(definition,horizontal);
  for(const node of verticalScene.nodes){const rotated=horizontalScene.nodes.find(item=>item.id===node.id);assert.equal(rotated.width,node.width);assert.equal(rotated.height,node.height)}
  const matrixTemplate=getBuiltinTemplate('builtin:matrix-grid'),matrix=buildSceneGeometry(materializeInstanceDefinition(matrixTemplate,createStructureInstance(matrixTemplate,'root')),createStructureInstance(matrixTemplate,'root'));assert.ok(matrix.nodes.every(node=>node.width===92&&node.height===62));
});

test('DOM priority, collision capsule, invalid-route fallback and offline codec are shipped',async()=>{
  const [css,renderer,controller,worker]=await Promise.all([
    readFile(new URL('../apps/web/styles.css',import.meta.url),'utf8'),readFile(new URL('../packages/ui/structure-renderer.js',import.meta.url),'utf8'),readFile(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),readFile(new URL('../apps/web/sw.js',import.meta.url),'utf8')
  ]);
  assert.match(css,/\.node-label\{[^}]*flex:0 0 auto[^}]*min-height/);assert.match(css,/\.edge-label-background\{/);assert.match(renderer,/chooseRelationLabelPlacement/);assert.match(controller,/无法打开此容器/);assert.doesNotMatch(controller,/this\.document\.split\(['"]:/);assert.match(worker,/packages\/navigation\/document-id\.js/);
});
