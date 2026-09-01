import test from 'node:test';
import assert from 'node:assert/strict';
import {importLkl} from '../packages/lkl/index.js';
import {buildImportPlan,commitImportPlan,importKnowledgePackage} from '../packages/lkl2/index.js';
import {materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {BUILTIN_TEMPLATES} from '../packages/structure-engine/templates.js';

const baseState=()=>({knowledge:[],relations:[],representations:[],structureTemplates:structuredClone(BUILTIN_TEMPLATES),structureInstances:[],variableSchemes:[],knowledgePackages:[],contentObjects:[],structureViews:[],boards:[],placements:[],settings:[]});
const packageSource=(templateRef,{title='Custom Instance Title',inlineTemplate=''}={})=>`lkl 2

package pkg:template-resolution {
  title "Template resolution"
  version "1.0"
  root knowledge root
}

knowledge root { title "Root" }

${inlineTemplate}
structure-instance axis {
  using ${templateRef}
  owner root
  title "${title}"
}

placement axis-placement {
  target structure axis
  parent knowledge root
  mode construct
  order 0
}
`;

const installedLkl1=()=>{
  const source=`lkl 1
structure custom:german-idealism-four-axis "德国观念论四哲学家主轴"
layout manual
slot kant "康德" philosopher many knowledge,structure {"order":0}
slot fichte "费希特" philosopher many knowledge,structure {"order":1}
slot schelling "谢林" philosopher many knowledge,structure {"order":2}
slot hegel "黑格尔" philosopher many knowledge,structure {"order":3}
end`;
  const result=importLkl(source);assert.equal(result.valid,true,result.errors?.[0]?.message);return result.definition;
};

test('LKL 2 keeps resolving builtin templates',()=>{
  const state=baseState(),parsed=importKnowledgePackage(packageSource('builtin:matrix-grid'),{templates:state.structureTemplates}),plan=buildImportPlan(parsed.package,state);
  assert.equal(parsed.valid,true,parsed.errors?.[0]?.message);assert.equal(plan.committable,true);assert.equal(plan.nextState.structureInstances.at(-1).templateId,'builtin:matrix-grid');
});

test('LKL 2 package-local custom template has priority and remains importable',()=>{
  const state=baseState(),inline=`structure-template custom:inline-four-axis {
  title "Inline four axis"
  layout grid
  slot a { title "A" }
  slot b { title "B" }
  slot c { title "C" }
  slot d { title "D" }
}`;
  const parsed=importKnowledgePackage(packageSource('custom:inline-four-axis',{inlineTemplate:inline}),{templates:state.structureTemplates}),plan=buildImportPlan(parsed.package,state),instance=plan.nextState.structureInstances.at(-1),template=plan.nextState.structureTemplates.find(item=>item.id===instance.templateId);
  assert.equal(parsed.valid,true,parsed.errors?.[0]?.message);assert.equal(plan.committable,true);assert.equal(template.stableId,'custom:inline-four-axis');assert.equal(materializeInstanceDefinition(template,instance).slots.length,4);
});

test('LKL 2 resolves a custom template previously installed through LKL 1',()=>{
  const state=baseState(),installed=installedLkl1();state.structureTemplates.push(installed);
  const parsed=importKnowledgePackage(packageSource(installed.id,{title:'康德—费希特—谢林—黑格尔主轴'}),{templates:state.structureTemplates}),plan=buildImportPlan(parsed.package,state),instance=plan.nextState.structureInstances.at(-1),template=plan.nextState.structureTemplates.find(item=>item.id===instance.templateId);
  assert.equal(parsed.valid,true,parsed.errors?.[0]?.message);assert.equal(plan.committable,true);assert.equal(instance.templateId,installed.id);assert.equal(instance.displayTitle,'康德—费希特—谢林—黑格尔主轴');assert.equal(materializeInstanceDefinition(template,instance).slots.length,4);
});

test('missing custom template produces a non-committable plan and no partial instance',async()=>{
  const state=baseState(),parsed=importKnowledgePackage(packageSource('custom:not-installed'),{templates:state.structureTemplates}),plan=buildImportPlan(parsed.package,state),unvalidated=structuredClone(parsed.package);delete unvalidated.validation;const defensivePlan=buildImportPlan(unvalidated,state);
  assert.equal(parsed.valid,false);assert.match(parsed.errors[0].message,/Unknown structure template reference: custom:not-installed/);assert.match(parsed.errors[0].suggestion,/Install the required LKL 1 Structure Template first/);for(const candidate of[plan,defensivePlan]){assert.equal(candidate.committable,false);assert.equal(candidate.nextState.structureInstances.length,0);await assert.rejects(()=>commitImportPlan(candidate),/Unknown structure template reference/)}
});

test('LKL 2 structure instance title persists independently from its template name',()=>{
  const state=baseState(),parsed=importKnowledgePackage(packageSource('builtin:matrix-grid',{title:'Custom Instance Title'}),{templates:state.structureTemplates}),plan=buildImportPlan(parsed.package,state),instance=plan.nextState.structureInstances.at(-1);
  assert.equal(plan.committable,true);assert.equal(instance.displayTitle,'Custom Instance Title');assert.equal(instance.objectContent.title,'Custom Instance Title');
});
