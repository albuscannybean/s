import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BUILTIN_TEMPLATES,getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {BUILTIN_VARIABLE_SCHEMES} from '../packages/structure-engine/variable-schemes.js';
import {addInstanceEdge,bindTarget,createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {createBoard,addBoardFrame} from '../packages/structure-engine/board.js';
import {createStructureQuery,matchStructureQuery,searchStructureQuery,validateStructureQuery} from '../packages/search-engine/query-engine.js';
import {createCommandRegistry,groupCommands,searchCommandRegistry} from '../packages/ui/command-registry.js';
import {validateLocalizedRecords} from '../packages/ui/localization.js';
import {buildImportPlan,commitImportPlan,exportStateKnowledgePackage,importKnowledgePackage,serializeKnowledgePackage} from '../packages/lkl2/index.js';
import {LKL_LIMITS,lklManualMarkdown} from '../packages/lkl2/schema.js';
import {APP_VERSION,workspaceExportFilename} from '../packages/app-metadata.js';

const baseState=()=>({knowledge:[],relations:[],representations:[],structureTemplates:structuredClone(BUILTIN_TEMPLATES),structureInstances:[],variableSchemes:[],knowledgePackages:[],contentObjects:[],structureViews:[],boards:[],placements:[],settings:[]});

test('workspace controller exposes one implementation per command and navigation method',()=>{
  const source=fs.readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),names=[...source.matchAll(/^  ([A-Za-z_$][\w$]*)\([^\n]*?\)\{/gm)].map(match=>match[1]),duplicates=[...new Set(names.filter((name,index)=>names.indexOf(name)!==index))];
  assert.deepEqual(duplicates,[]);
  for(const name of['commands','renderCommands','executeCommand','renderNavigator','openKnowledge','openInstance'])assert.equal(names.filter(value=>value===name).length,1,name);
});

test('RC completion uses the native scene for query nesting and keeps camera/theme controls live',()=>{
  const controller=fs.readFileSync(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),renderer=fs.readFileSync(new URL('../packages/ui/structure-renderer.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../apps/web/styles.css',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../apps/web/index.html',import.meta.url),'utf8');
  assert.match(controller,/renderStructureQueryEditor[\s\S]*renderSceneGeometry/);assert.match(controller,/onDropStructure:\(templateId,slotId\)=>this\.nestTemplateAtSlot/);assert.match(renderer,/text\/lmn-template-id/);
  assert.match(controller,/ensureStructureView\(this\.instance\)\.camera\[key\]=sync/);assert.match(controller,/navigatorPathSignature!==signature/);assert.match(controller,/pathNeedsRow/);
  for(const label of['松柏绿','湖水蓝','藤萝紫','石墨灰','夜幕黑'])assert.match(html,new RegExp(label));assert.match(css,/data-theme="dark"/);assert.match(css,/camera-angle-control/);
  assert.match(controller,/if\(!modular\)this\.field\(grid,'显示公式'/);assert.match(controller,/if\(!modular\)\{this\.field\(grid,'图标'/);
});

test('command registry is unique, grouped, fuzzy-searchable and keeps disabled reasons',()=>{
  const app={knowledge:null,instance:null,template:null,selection:new Set(),openQuickCreate(){},renderNavigator(){},openLibrary(){},openSearchWorkbench(){},openStructureSource(){},openPanel(){},renameKnowledge(){},deleteKnowledge(){},executeCreateAction(){},deleteSelection(){},startTemporaryConnection(){},openLklManual(){},openImport(){},exportAs(){},fit(){},toggleFocus(){},openGlobalSettings(){},document:''},commands=createCommandRegistry(app);
  assert.equal(new Set(commands.map(item=>item.id)).size,commands.length);
  const hit=searchCommandRegistry(commands,'strctcode')[0];assert.equal(hit.id,'structure.code');assert.equal(hit.enabled,false);assert.match(hit.disabledReason,/结构/);
  assert.ok(groupCommands(searchCommandRegistry(commands,'')).has('LKL'));
});

test('Query AST matches direction, nested structure and returns exact highlights',()=>{
  const state=baseState(),rootTemplate=getBuiltinTemplate('builtin:lmn-432'),childTemplate=getBuiltinTemplate('builtin:directed-graph'),root=createStructureInstance(rootTemplate,'knowledge'),child=createStructureInstance(childTemplate,'knowledge');state.structureInstances.push(root,child);bindTarget(root,rootTemplate,'M2','structure',child.id,{placementMode:'construct'});
  const rootQuery=createStructureQuery(rootTemplate,materializeInstanceDefinition(rootTemplate,root),{mode:'contains'}),childQuery=createStructureQuery(childTemplate,materializeInstanceDefinition(childTemplate,child),{mode:'subgraph'});rootQuery.nodes.find(node=>node.id==='M2').nested=childQuery;
  const matched=matchStructureQuery(rootQuery,root,state);assert.equal(matched.matched,true);assert.ok(matched.nodeIds.includes('M2'));assert.ok(matched.edgeIds.length>0);assert.equal(searchStructureQuery(rootQuery,state).length,1);assert.equal(validateStructureQuery(rootQuery).valid,true);
  rootQuery.edges[0].direction='undirected';assert.equal(matchStructureQuery(rootQuery,root,state).matched,false);
});

test('Knowledge Package round-trip preserves board frames, plots, motion and design state',async()=>{
  const state=baseState(),knowledge={id:'knowledge-root',title:'Root'},template=getBuiltinTemplate('builtin:coordinate-plane'),instance=createStructureInstance(template,knowledge.id,{dimension:'3d'});instance.plotExpressions=[{id:'surface',label:'曲面',source:'paraboloid(a=.2)',rangeMode:'viewport'}];instance.motionPoints=[{id:'motion',plotId:'surface',label:'M',start:0,end:1,duration:4,mode:'loop',playing:false}];instance.designStyles.nodeDefault={fill:'#999999'};instance.relationStyles.structureDefault={routing:'straight',arrow:'both'};state.knowledge.push(knowledge);state.structureInstances.push(instance);const board=createBoard(knowledge.id,'Board');addBoardFrame(board,instance.id,{x:44,y:55,width:700,height:520});state.boards.push(board);
  const model=exportStateKnowledgePackage(state,{rootKnowledgeId:knowledge.id,packageId:'pkg:hardening'}),source=serializeKnowledgePackage(model),parsed=importKnowledgePackage(source);assert.equal(parsed.valid,true,parsed.errors?.[0]?.message);const restored=await commitImportPlan(buildImportPlan(parsed.package,baseState())),copy=restored.structureInstances[0];
  assert.equal(restored.boards.length,1);assert.equal(restored.boards[0].frames.length,1);assert.equal(copy.plotExpressions[0].id,'surface');assert.equal(copy.motionPoints[0].id,'motion');assert.equal(copy.designStyles.nodeDefault.fill,'#999999');assert.equal(copy.relationStyles.structureDefault.arrow,'both');
});

test('explicit LKL placements materialize stable navigator bindings',()=>{
  const state=baseState(),knowledge={id:'placement-root',title:'Root'},parentTemplate=getBuiltinTemplate('builtin:lmn-432'),childTemplate=getBuiltinTemplate('builtin:directed-graph'),parent=createStructureInstance(parentTemplate,knowledge.id),child=createStructureInstance(childTemplate,knowledge.id);state.knowledge.push(knowledge);state.structureInstances.push(parent,child);bindTarget(parent,parentTemplate,'M2','structure',child.id,{placementMode:'reference'});
  const model=exportStateKnowledgePackage(state,{rootKnowledgeId:knowledge.id,packageId:'pkg:placements'}),parentModel=model.structureInstances.find(item=>item.templateRef==='builtin:lmn-432'),container=parentModel.containers.find(item=>item.slotId==='M2');container.structureRefs=[];
  const parsed=importKnowledgePackage(serializeKnowledgePackage(model));assert.equal(parsed.valid,true,parsed.errors?.[0]?.message);const plan=buildImportPlan(parsed.package,baseState()),restoredParent=plan.nextState.structureInstances.find(item=>item.templateId==='builtin:lmn-432'),restoredChild=restoredParent.containers.M2.children.find(item=>item.type==='structure');
  assert.ok(restoredChild);assert.equal(restoredChild.metadata.placementMode,'reference');assert.equal(restoredParent.bindings.find(item=>item.targetId===restoredChild.targetId).metadata.placementMode,'reference');
});

test('LKL rejects unsafe sources, publishes limits and schema-generated manual',()=>{
  const source=`lkl 2\npackage p {\n title "p"\n version "1"\n root knowledge k\n}\nknowledge k { title "K" }\nsource bad {\n title "bad"\n url "javascript:alert(1)"\n}`;
  const parsed=importKnowledgePackage(source);assert.equal(parsed.valid,false);assert.match(parsed.errors[0].message,/javascript/);assert.ok(LKL_LIMITS.maxDeclarations>=1000);assert.match(lklManualMarkdown(),/preview-policy/);assert.match(lklManualMarkdown(),/placement/);
});

test('built-in templates and variable schemes expose bilingual metadata and semantic defaults',()=>{
  assert.deepEqual(validateLocalizedRecords(BUILTIN_TEMPLATES),[]);assert.deepEqual(validateLocalizedRecords(BUILTIN_VARIABLE_SCHEMES),[]);
  const coordinate=createStructureInstance(getBuiltinTemplate('builtin:coordinate-plane'),'knowledge'),graph=createStructureInstance(getBuiltinTemplate('builtin:directed-graph'),'knowledge'),edge=addInstanceEdge(graph,'graph-source','graph-target');
  assert.equal(coordinate.structureView.previewPolicy,'off');assert.equal(edge.routing,'straight');assert.equal(workspaceExportFilename(7),`lmn-workspace-v${APP_VERSION}-7.json`);
});

test('target-case example packages parse without warnings',()=>{
  for(const file of['calculus-package-v4.3.lkl','mod12-chart-v4.3.lkl']){const source=fs.readFileSync(new URL(`../examples/${file}`,import.meta.url),'utf8'),parsed=importKnowledgePackage(source);assert.equal(parsed.valid,true,`${file}: ${parsed.errors?.[0]?.message}`);assert.deepEqual(parsed.warnings,[],file)}
});

test('offline cache includes every V4.3 controller dependency',()=>{
  const worker=fs.readFileSync(new URL('../apps/web/sw.js',import.meta.url),'utf8');assert.match(worker,/lmn-v4\.3\.1-stable-20260904-1/);for(const asset of['packages/app-metadata.js','packages/ui/localization.js','packages/ui/command-registry.js','packages/navigation/document-id.js','packages/navigation/tab-session.js','packages/geometry/geometry-operands.js','packages/structure-engine/board.js','packages/search-engine/query-engine.js','packages/cognitive-runtime/task-context.js','packages/cognitive-runtime/semantic-index.js','packages/cognitive-runtime/activation.js','packages/cognitive-runtime/derived-projection.js','packages/lkl2/schema.js'])assert.match(worker,new RegExp(asset.replace(/[./]/g,'\\$&')),asset);
});
