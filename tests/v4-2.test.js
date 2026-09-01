import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderMathToString,MATH_RENDERER_ID} from '../packages/ui/math-markup.js';
import {effectiveSlotIdentity,getEffectiveTitle,setLocalDisplayTitle} from '../packages/domain/identity.js';
import {buildSceneGeometry,lmnSemanticCenters} from '../packages/geometry/scene-geometry.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {ensureStructureView,rotateStructureView} from '../packages/structure-engine/structure-view.js';
import {runInstance} from '../packages/structure-engine/evaluator.js';
import {createKnowledge} from '../packages/domain/core.js';
import {addContainerContent} from '../packages/domain/semantic-container.js';
import {buildImportPlan,commitImportPlan,detectLklVersion,exportStateKnowledgePackage,importKnowledgePackage,semanticEquivalent,serializeKnowledgePackage} from '../packages/lkl2/index.js';

const SOURCE=String.raw`lkl 2
package calculus {
  id "pkg:calculus"
  title "微积分"
  version "1.0"
  root knowledge calculus
  defaultEntry start
}

knowledge calculus {
  title "微积分"
  aliases ["Calculus", "分析学"]
  summary """研究变化。"""
  body markdown """设 $x\in\mathbb{R}$。

$$
\frac{\partial f}{\partial x}
$$
"""
  tags ["分析", "数学"]
}

knowledge derivative {
  title "导数"
}

content derivative_definition {
  type definition
  title "导数定义"
  body markdown """定义正文逐字符保留。"""
}

content derivative_formula {
  type formula
  title "导数公式"
  latex """\operatorname{D}f=\frac{\partial f}{\partial x}"""
}

structure-instance calculus_lmn {
  using builtin:lmn-432
  owner calculus
  container M2 {
    knowledge derivative
    content derivative_definition
    content derivative_formula
    structure nested_mod
  }
}

structure-instance nested_mod {
  using builtin:mod-n
  owner calculus
  parameter modulus = 12
  container mod-4 {
    structure nested_hasse
  }
  variable wenchang {
    display-name "文昌"
    kind derived
    expression "mod(hour + 2, modulus)"
    display-formula "w \equiv h+2 \pmod n"
  }
  variable hour {
    display-name "时辰"
    kind input
    value 2
  }
}

structure-instance nested_hasse {
  using builtin:poset-hasse
  owner derivative
  parameter starter = "diamond"
  container bottom {
    structure calculus_lmn
  }
}

relation derivative_requires_limit {
  from knowledge derivative
  to knowledge calculus
  type depends-on
  label "依赖"
  body markdown """导数依赖极限。"""
}

view modular_chart {
  for nested_mod
  mode chart
  orientation {
    zero bottom
    direction clockwise
    rotation 15deg
  }
  zoom-policy semantic
  semantic-zoom true
}

entry start {
  title "开始阅读"
  knowledge calculus
}
`;

test('local KaTeX is the single complete renderer for required formulas',()=>{
  assert.equal(MATH_RENDERER_ID,'katex-local-0.16.25');
  for(const formula of[String.raw`\mathbb{R}`,String.raw`a\odot b`,String.raw`\operatorname{Spec}(R)`,String.raw`\frac{\partial f}{\partial x}`,String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`,String.raw`f(x)=\begin{cases}x&x>0\\0&x\le0\end{cases}`]){const result=renderMathToString(formula,{display:true});assert.equal(result.ok,true,result.error?.message);assert.match(result.html,/class="katex"/);assert.equal(result.source,formula)}
  const broken=renderMathToString(String.raw`\frac{`);assert.equal(broken.ok,false);assert.equal(broken.source,String.raw`\frac{`);
});

test('effective title follows Knowledge unless a local override exists',()=>{
  const slot={id:'M2',label:'构造论',role:'construction',semanticCoordinate:{column:'M',layer:2}},knowledge={id:'k1',title:'导数'},state={knowledge:[knowledge]},instance={bindings:[{slotId:'M2',targetType:'knowledge',targetId:'k1'}],containers:{M2:{id:'M2',children:[]}}};
  assert.equal(getEffectiveTitle(slot,{kind:'slot',instance,state}),'导数');setLocalDisplayTitle(instance,'M2','导数的构造');assert.equal(effectiveSlotIdentity(slot,{instance,state,container:instance.containers.M2}).effectiveTitle,'导数的构造');assert.equal(knowledge.title,'导数');setLocalDisplayTitle(instance,'M2','');knowledge.title='微分';assert.equal(getEffectiveTitle(slot,{kind:'slot',instance,state}),'微分');
});

test('LMN semantic layout uses exact center midpoints independent of labels',()=>{
  const centers=lmnSemanticCenters({startY:170,gapY:132});for(let index=0;index<3;index++)assert.equal(centers.M[index],(centers.L[index]+centers.L[index+1])/2);for(let index=0;index<2;index++)assert.equal(centers.N[index],(centers.M[index]+centers.M[index+1])/2);
  const template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template),definition=materializeInstanceDefinition(template,instance),scene=buildSceneGeometry(definition,instance),center=id=>{const node=scene.nodes.find(item=>item.id===id);return node.y+node.height/2};assert.equal(center('M2'),(center('L2')+center('L3'))/2);assert.equal(center('N1'),(center('M1')+center('M2'))/2);definition.slots.find(item=>item.id==='L2').label='一段很长但不会改变锚点的说明';assert.equal(buildSceneGeometry(definition,instance).nodes.find(item=>item.id==='M2').semanticCenterY,center('M2'));
});

test('Modular Structure view rotation changes geometry but never results',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template,null,{modulus:12});instance.variables=Array.from({length:20},(_,index)=>({id:`v${index}`,label:`变量 ${index}`,displayName:`变量 ${index}`,kind:'input',type:'integer',value:index%12,showOnCanvas:true}));const definition=materializeInstanceDefinition(template,instance);runInstance(instance,definition);const before=structuredClone(instance.runtimeState.results),view=ensureStructureView(instance);view.displayMode='chart';view.orientation.zeroAnchor='bottom';const chart=buildSceneGeometry(definition,instance);assert.equal(chart.nodes.every(node=>node.visualKind==='modular-chart-cell'),true);assert.equal(chart.tokens.length<=12*6,true);assert.equal(new Set(chart.tokens.map(token=>`${token.index}:${token.x}:${token.y}`)).size,chart.tokens.length);const x=chart.nodes.find(node=>node.id==='mod-0').x;rotateStructureView(instance,90);const rotated=buildSceneGeometry(definition,instance);assert.notEqual(rotated.nodes.find(node=>node.id==='mod-0').x,x);assert.deepEqual(instance.runtimeState.results,before);view.displayMode='structure';assert.equal(buildSceneGeometry(definition,instance).tokens.length,0);
});

test('LKL 2 parses a real Knowledge Package and round-trips semantic source',()=>{
  assert.equal(detectLklVersion(SOURCE),2);const first=importKnowledgePackage(SOURCE,{templates:[getBuiltinTemplate('builtin:lmn-432'),getBuiltinTemplate('builtin:mod-n'),getBuiltinTemplate('builtin:poset-hasse')]});assert.equal(first.valid,true,JSON.stringify(first.errors));assert.equal(first.package.knowledge.length,2);assert.equal(first.package.contents.length,2);assert.equal(first.package.structureInstances.length,3);assert.equal(first.package.structureInstances[0].containers[0].contentRefs.length,2);assert.equal(first.package.knowledge[0].body.includes(String.raw`\frac{\partial f}{\partial x}`),true);const serialized=serializeKnowledgePackage(first.package),second=importKnowledgePackage(serialized,{templates:[getBuiltinTemplate('builtin:lmn-432'),getBuiltinTemplate('builtin:mod-n'),getBuiltinTemplate('builtin:poset-hasse')]});assert.equal(second.valid,true,JSON.stringify(second.errors));assert.equal(second.package.knowledge[0].body,first.package.knowledge[0].body);assert.equal(second.package.contents[1].latex,first.package.contents[1].latex);assert.equal(second.package.views[0].orientation.zeroAnchor,'bottom');assert.equal(second.package.views[0].orientation.rotationAngle,15);assert.equal(semanticEquivalent(first.package,second.package),true);
});

test('LKL 2 import is transactional, stable on merge, copyable, and opens root',async()=>{
  const parsed=importKnowledgePackage(SOURCE,{templates:[getBuiltinTemplate('builtin:lmn-432'),getBuiltinTemplate('builtin:mod-n'),getBuiltinTemplate('builtin:poset-hasse')]});const base={knowledge:[],relations:[],representations:[],structureTemplates:[getBuiltinTemplate('builtin:lmn-432'),getBuiltinTemplate('builtin:mod-n'),getBuiltinTemplate('builtin:poset-hasse')],structureInstances:[],variableSchemes:[],knowledgePackages:[],contentObjects:[],structureViews:[]},plan=buildImportPlan(parsed.package,base,{strategy:'merge'});assert.equal(plan.committable,true);assert.equal(plan.rootTarget.type,'knowledge');const state=await commitImportPlan(plan);assert.equal(state.knowledge.length,2);assert.equal(state.structureInstances.length,3);assert.equal(state.contentObjects.length,2);const lmn=state.structureInstances.find(item=>item.externalStableId.endsWith('structure-instance:calculus_lmn')),m2=lmn.containers.M2;assert.equal(m2.children.filter(item=>['content','formula'].includes(item.type)).length,2);assert.equal(m2.children.some(item=>item.type==='formula'),true);assert.equal(m2.children.some(item=>item.type==='structure'),true);const merge=buildImportPlan(parsed.package,state,{strategy:'merge'}),merged=await commitImportPlan(merge);assert.equal(merged.knowledge.length,2);assert.equal(merge.updates.length>0,true);const copy=await commitImportPlan(buildImportPlan(parsed.package,state,{strategy:'copy',copyNamespace:'pkg:calculus-copy'}));assert.equal(copy.knowledge.length,4);assert.equal(new Set(copy.knowledge.map(item=>item.externalStableId)).size,4);
  const invalid=importKnowledgePackage(SOURCE.replace('to knowledge calculus','to knowledge missing'));assert.equal(invalid.valid,false);const failed=buildImportPlan(invalid.package,base,{strategy:'merge',strict:true});assert.equal(failed.committable,false);await assert.rejects(()=>commitImportPlan(failed));assert.equal(base.knowledge.length,0);
});

test('LKL 2 workspace export keeps inline documents, formulas, and custom templates',async()=>{
  const knowledge=createKnowledge('本地数学包'),template={id:'custom:pair',name:'Pair Structure',description:'Two semantic positions.',version:1,category:'custom',builtin:false,nestable:true,computable:false,slots:[{id:'left',label:'Left',role:'domain',semanticCoordinate:{order:0},accepts:['knowledge','structure','value','variable'],cardinality:'many'},{id:'right',label:'Right',role:'codomain',semanticCoordinate:{order:1},accepts:['knowledge','structure','value','variable'],cardinality:'many'}],edges:[{id:'arrow',sourceSlotId:'left',targetSlotId:'right',direction:'directed',relationType:'maps-to'}],parameters:[],variables:[],constraints:[],rules:[],layout:{type:'layered'},visual:{accent:'#557c91'}},instance=createStructureInstance(template,knowledge.id);
  addContainerContent(instance,'left',{id:'inline-note',type:'content',content:{title:'局部正文',summary:'导出正文',body:'# 正文\n\n保持 $x^2$。',contentType:'theorem',tags:['测试']}},template);addContainerContent(instance,'right',{id:'inline-formula',type:'formula',content:{title:'公式',body:'$$\\int_0^1 x^2\\,dx$$',displayFormula:'\\int_0^1 x^2\\,dx',contentType:'custom'}},template);
  const state={knowledge:[knowledge],relations:[],representations:[],structureTemplates:[template],structureInstances:[instance],variableSchemes:[],knowledgePackages:[],contentObjects:[],structureViews:[]},model=exportStateKnowledgePackage(state,{rootKnowledgeId:knowledge.id,packageId:'pkg:inline'});
  assert.equal(model.contents.length,2);assert.equal(model.structureTemplates.length,1);assert.deepEqual(model.structureInstances[0].containers.map(item=>item.contentRefs.length),[1,1]);
  const parsed=importKnowledgePackage(serializeKnowledgePackage(model));assert.equal(parsed.valid,true,JSON.stringify(parsed.errors));const base={knowledge:[],relations:[],representations:[],structureTemplates:[],structureInstances:[],variableSchemes:[],knowledgePackages:[],contentObjects:[],structureViews:[]},restored=await commitImportPlan(buildImportPlan(parsed.package,base));assert.equal(restored.contentObjects.length,2);assert.equal(restored.structureTemplates.length,1);assert.equal(restored.structureInstances[0].containers.right.children[0].type,'formula');assert.equal(restored.contentObjects.find(item=>item.title==='局部正文').body.includes('$x^2$'),true);
});

test('V4.2 source exposes document-first editing, transient close rules, and visible delete undo',async()=>{
  const[html,controller,editor,overlay,css]=await Promise.all([readFile(new URL('../apps/web/index.html',import.meta.url),'utf8'),readFile(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),readFile(new URL('../packages/ui/document-editor.js',import.meta.url),'utf8'),readFile(new URL('../packages/ui/transient-overlay-manager.js',import.meta.url),'utf8'),readFile(new URL('../apps/web/styles.css',import.meta.url),'utf8')]);assert.match(html,/id="undoBanner"/);assert.match(html,/id="undoDeleteAction">撤回/);assert.match(controller,/Ctrl\+Z|key\.toLowerCase\(\)==='z'/);assert.match(controller,/showUndoBanner\(label\)/);assert.match(editor,/document-title-input/);assert.match(editor,/document-body-editor/);assert.doesNotMatch(editor,/textContent='保存'/);assert.match(overlay,/outside|empty-blur|navigation|superseded/);assert.match(css,/\.undo-banner/);
});
