import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';
import {addInstanceEdge,addInstanceSlot,createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {createKnowledgeWorkspaceRecords} from '../packages/structure-engine/knowledge-workflow.js';
import {BUILTIN_TEMPLATES,getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {parseMathExpression,parseStudyMarkdown,tokenizeInline} from '../packages/ui/math-markup.js';

test('Blank Knowledge is default-capable and explicit LMN creates exactly one root',()=>{
  const template=getBuiltinTemplate('builtin:lmn-432'),blank=createKnowledgeWorkspaceRecords('群'),withLmn=createKnowledgeWorkspaceRecords('群论',{withLmn:true,lmnTemplate:template});
  assert.equal(blank.structureInstances.length,0);
  assert.equal(blank.representations.length,0);
  assert.equal(withLmn.structureInstances.length,1);
  assert.equal(withLmn.structureInstances[0].templateId,'builtin:lmn-432');
  assert.equal(withLmn.representations[0].data.root,true);
});

test('LMN mediation and feedback directions match V4.1 theory',()=>{
  const edges=new Map(getBuiltinTemplate('builtin:lmn-432').edges.map(edge=>[edge.id,edge]));
  assert.deepEqual(['e1','e2','e3','e4','e5','e6'].map(id=>[edges.get(id).sourceSlotId,edges.get(id).targetSlotId]),[['L1','M1'],['M1','L2'],['L2','M2'],['M2','L3'],['L3','M3'],['M3','L4']]);
  assert.deepEqual(['e7','e8','e9','e10'].map(id=>[edges.get(id).sourceSlotId,edges.get(id).targetSlotId,edges.get(id).direction]),[['N1','M1','directed'],['N1','M2','directed'],['N2','M2','directed'],['N2','M3','directed']]);
  assert.equal(getBuiltinTemplate('builtin:lmn-432').slots.find(slot=>slot.id==='N1').role,'symbolization');
});

test('force graph layout is deterministic, compact, and not a grid fallback',()=>{
  const template=getBuiltinTemplate('builtin:directed-graph'),instance=createStructureInstance(template);
  for(const id of['D','E','F','G','H'])addInstanceSlot(instance,{id,label:id,role:'node'});
  for(const[source,target,index]of[['A','D',0],['D','E',1],['E','F',2],['F','G',3],['G','H',4],['H','A',5],['B','F',6],['C','G',7]])addInstanceEdge(instance,source,target,{id:`extra-${index}`});
  const definition=materializeInstanceDefinition(template,instance),first=buildSceneGeometry(definition,instance),second=buildSceneGeometry(definition,instance);
  assert.equal(first.nodes.length,8);assert.equal(first.edges.length,10);assert.equal(first.layout,'force');
  assert.ok(first.nodes.every(node=>node.visualKind==='graph-node'&&node.width<=110));
  assert.ok(new Set(first.nodes.map(node=>Math.round(node.y))).size>3);
  assert.deepEqual(first.nodes.map(node=>[node.x,node.y]),second.nodes.map(node=>[node.x,node.y]));
});

test('Boolean, Venn, coordinate, and Cayley table expose mathematical visual grammar',()=>{
  const booleanTemplate=getBuiltinTemplate('builtin:boolean-algebra'),booleanInstance=createStructureInstance(booleanTemplate,null,{rank:4}),booleanScene=buildSceneGeometry(materializeInstanceDefinition(booleanTemplate,booleanInstance),booleanInstance);
  assert.equal(booleanScene.nodes.length,16);assert.ok(booleanScene.nodes.every(node=>node.visualKind==='boolean-node'&&node.width<=70));
  const vennTemplate=getBuiltinTemplate('builtin:venn-2'),vennInstance=createStructureInstance(vennTemplate),vennScene=buildSceneGeometry(materializeInstanceDefinition(vennTemplate,vennInstance),vennInstance);
  assert.equal(vennScene.background.filter(item=>item.type==='circle').length,2);
  const coordinateTemplate=getBuiltinTemplate('builtin:coordinate-plane'),coordinateInstance=createStructureInstance(coordinateTemplate),coordinateScene=buildSceneGeometry(materializeInstanceDefinition(coordinateTemplate,coordinateInstance),coordinateInstance),point=coordinateScene.nodes.find(node=>node.id==='P');
  assert.ok(coordinateScene.background.filter(item=>item.className==='coordinate-axis').length>=2);assert.equal(point.x+point.width/2,500+2*40);assert.equal(point.y+point.height/2,360-3*40);
  const tableTemplate=getBuiltinTemplate('builtin:operation-table'),tableInstance=createStructureInstance(tableTemplate,null,{n:4}),tableScene=buildSceneGeometry(materializeInstanceDefinition(tableTemplate,tableInstance),tableInstance);
  assert.equal(tableScene.nodes.length,16);assert.equal(tableScene.background.filter(item=>item.className==='table-header-cell').length,9);assert.ok(tableScene.nodes.every(node=>node.visualKind==='table-cell'));
});

test('offline math parser and study blocks keep formulas as structured content',()=>{
  const ast=parseMathExpression('a(bc)=(ab)c + \\frac{1}{2}x^2'),blocks=parseStudyMarkdown('群 $G$ 满足：\n\n$$\na(bc)=(ab)c\n$$\n\n::: theorem\n拉格朗日定理\n:::'),inline=tokenizeInline('$(G,\\cdot)$ 是 **群**');
  assert.equal(ast.type,'sequence');assert.ok(ast.children.some(child=>child.type==='fraction'));
  assert.deepEqual(blocks.map(block=>block.type),['paragraph','math','study']);assert.equal(blocks[2].kind,'theorem');
  assert.deepEqual(inline.map(token=>token.type),['math','text','strong']);
});

test('every built-in template is filterable or explicitly experimental',()=>{
  const categories=new Set(['lmn','graph','algebra','geometry','modular','poset','logic','set','venn','coordinate','analysis','custom']);
  for(const template of BUILTIN_TEMPLATES){assert.ok(['ready','experimental'].includes(template.maturity),template.name);assert.ok(categories.has(template.category)||template.maturity==='experimental',template.name)}
  for(const template of BUILTIN_TEMPLATES.filter(item=>item.description==='Experimental · basic editable skeleton'))assert.equal(template.maturity,'experimental');
});
