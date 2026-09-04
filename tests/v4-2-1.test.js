import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getBuiltinTemplate,materializeTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition} from '../packages/structure-engine/model.js';
import {runInstance} from '../packages/structure-engine/evaluator.js';
import {canonicalizeLegacyModExpression,normalizeVariableResult,resultSpaceLabel} from '../packages/structure-engine/variable-result-normalizer.js';
import {buildPositionIndex} from '../packages/domain/semantic-container.js';
import {objectQuickPreview} from '../packages/structure-engine/presentation-adapters.js';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';
import {ensureStructureView} from '../packages/structure-engine/structure-view.js';
import {setLocalDisplayTitle,getEffectiveTitle} from '../packages/domain/identity.js';
import {VariableSchemeRepository,applyVariableScheme,createVariableScheme} from '../packages/structure-engine/variable-schemes.js';
import {resetRelationStyle,resolveRelationStyle,setRelationStyle} from '../packages/structure-engine/relation-style-resolver.js';
import {getStructureInteractionAdapter,structureCreateActions} from '../packages/structure-engine/interaction-adapters.js';
import {applyStructureInstanceDraft,parseStructureInstanceSource,serializeStructureInstance} from '../packages/lkl2/structure-source.js';

test('modular result space normalizes plain expressions and only canonicalizes strict legacy wrappers',()=>{
  const space={type:'modular',modulusParameter:'modulus'};assert.equal(normalizeVariableResult(14,space,{modulus:12}),2);assert.equal(normalizeVariableResult(-1,space,{modulus:12}),11);assert.equal(resultSpaceLabel(space,{modulus:12}),'ℤ/12ℤ');const legacy=canonicalizeLegacyModExpression('mod(hour + 2, modulus)',space),fixed=canonicalizeLegacyModExpression('mod(hour + 2, 7)',space);assert.equal(legacy.canonicalized,true);assert.equal(legacy.formula,'hour + 2');assert.equal(fixed.canonicalized,false);assert.equal(fixed.formula,'mod(hour + 2, 7)')
});

test('Modular Ring evaluates user formulas without explicit mod and keeps result-space metadata',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template,null,{modulus:12});instance.variables=[{id:'hour',label:'小时',kind:'input',type:'integer',value:11},{id:'next',label:'下一小时',kind:'derived',type:'integer',formula:'hour + 2',expression:{op:'add',args:[{var:'hour'},{value:2}]},showOnCanvas:true}];instance.runtimeState.variables.hour=11;const out=runInstance(instance,materializeInstanceDefinition(template,instance));assert.equal(out.results.next,1);assert.deepEqual(instance.resultSpace,{type:'modular',modulusParameter:'modulus'})
});

test('Modular quick preview is readable and excludes formulas, internal ids, and raw result values',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template,null,{modulus:12});instance.variables=[{id:'private_internal_id',label:'文昌',displayName:'文昌',kind:'derived',formula:'hour + 2',expression:{op:'add',args:[{var:'hour'},{value:2}]},showOnCanvas:true},{id:'hour',label:'时',kind:'input',value:10}];instance.runtimeState.variables.hour=10;const definition=materializeInstanceDefinition(template,instance);runInstance(instance,definition);const index=buildPositionIndex(instance,definition),slot=definition.slots.find(item=>item.id==='mod-0'),preview=objectQuickPreview(template,{slot,entry:index.bySlotId['mod-0'],instance,definition});assert.equal(preview.title,'位置 0');assert.deepEqual(preview.lines,['文昌']);const text=JSON.stringify(preview);assert.doesNotMatch(text,/hour \+ 2|private_internal_id|"result"|12\.0/)
});

test('chart mode renders readable variable-name pills with bounded stacks and overflow',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template,null,{modulus:7});instance.variables=Array.from({length:9},(_,index)=>({id:`internal_${index}`,label:`变量 ${index+1}`,kind:'input',value:3,showOnCanvas:true}));Object.assign(instance.runtimeState.variables,Object.fromEntries(instance.variables.map(item=>[item.id,item.value])));ensureStructureView(instance).displayMode='chart';const scene=buildSceneGeometry(materializeInstanceDefinition(template,instance),instance),tokens=scene.tokens.filter(item=>item.index===3);assert.equal(tokens.length,5);assert.equal(tokens.at(-1).overflowCount,4);assert.ok(tokens.every(item=>item.label.startsWith('变量 ')&&item.width>=72&&item.height>=24));assert.equal(tokens.some(item=>!item.label.trim()),false)
});

test('all generated mathematical nodes support local display titles without changing canonical identity',()=>{
  for(const id of['builtin:lmn-432','builtin:mod-n','builtin:boolean-algebra','builtin:venn-2','builtin:poset-hasse','builtin:coordinate-plane']){const template=getBuiltinTemplate(id),instance=createStructureInstance(template),definition=materializeInstanceDefinition(template,instance),slot=definition.slots[0];if(!slot)continue;setLocalDisplayTitle(instance,slot.id,'局部显示名');assert.equal(getEffectiveTitle(slot,{kind:'slot',instance,container:instance.containers[slot.id]}),'局部显示名');assert.equal(materializeInstanceDefinition(template,instance).slots[0].id,slot.id);assert.equal(getStructureInteractionAdapter(template).getContainerCapabilities(slot,instance,template).canRenameDisplayLabel,true)}
});

test('Variable Scheme repository enforces built-in and custom lifecycle without touching applied variables',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template);instance.variables=[{id:'x',label:'x',kind:'input',value:2}];const custom=createVariableScheme('我的方案',instance),repository=new VariableSchemeRepository([custom]),builtin=repository.list({category:'builtin'})[0];repository.update(builtin.id,{parameters:{modulus:19}});assert.equal(repository.get(builtin.id).parameters.modulus,19);repository.update(builtin.id,{hidden:true});const copy=repository.copyAsMine(builtin.id);assert.equal(copy.category,'mine');repository.update(custom.id,{title:'改名方案',favorite:true});const source=repository.export(custom.id),imported=new VariableSchemeRepository().import(source);assert.equal(imported.title,'改名方案');applyVariableScheme(instance,custom,{replace:true});repository.remove(custom.id);repository.remove(builtin.id);assert.equal(repository.get(builtin.id),null);assert.equal(instance.variables[0].id,'x')
});

test('Relation Style cascade respects edge, type, structure, and global priority with reset',()=>{
  const template=getBuiltinTemplate('builtin:directed-graph'),instance=createStructureInstance(template),edge=materializeInstanceDefinition(template,instance).edges[0];setRelationStyle(instance,{scope:'structure'},{color:'#111111',width:2});setRelationStyle(instance,{scope:'type',relationType:edge.relationType},{color:'#222222'});setRelationStyle(instance,{scope:'edge',edgeIds:[edge.id]},{color:'#333333',lineStyle:'dashed'});let style=resolveRelationStyle(edge,instance,{globalTheme:{color:'#000000',opacity:.5}});assert.equal(style.color,'#333333');assert.equal(style.width,2);assert.equal(style.opacity,.5);resetRelationStyle(instance,{scope:'edge',edgeIds:[edge.id]});style=resolveRelationStyle(edge,instance);assert.equal(style.color,'#222222')
});

test('Structure interaction adapters expose domain-specific add actions and never offer fake residues',()=>{
  const actions=id=>structureCreateActions(getBuiltinTemplate(id)).map(item=>item.id);assert.deepEqual(actions('builtin:lmn-432'),['add-knowledge','add-container-content','add-structure']);assert.ok(actions('builtin:mod-n').includes('change-modulus'));assert.equal(actions('builtin:mod-n').some(id=>/residue/i.test(id)),false);assert.ok(actions('builtin:boolean-algebra').includes('rename-selected'));assert.ok(actions('builtin:poset-hasse').includes('import-poset-relations'));assert.ok(actions('builtin:venn-2').includes('venn-add-set'));assert.deepEqual(actions('builtin:coordinate-plane').slice(0,2),['add-point','add-vector'])
});

test('Structure source workbench round-trips titles, variables, view, styles, and preserves canonical topology',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template,null,{modulus:12});setLocalDisplayTitle(instance,'mod-2','第二位置');instance.variables=[{id:'hour',label:'小时',kind:'input',type:'integer',value:2,showOnCanvas:false},{id:'next',label:'下一小时',kind:'derived',type:'integer',formula:'hour + 2',expression:{op:'add',args:[{var:'hour'},{value:2}]},showOnCanvas:true,resultSpace:instance.resultSpace}];setRelationStyle(instance,{scope:'type',relationType:'successor'},{color:'#123456'});const source=serializeStructureInstance(template,instance),parsed=parseStructureInstanceSource(source,{template,instance});assert.equal(parsed.valid,true,parsed.diagnostics?.[0]?.message);assert.equal(parsed.draft.containers['mod-2'].localDisplayTitle,'第二位置');assert.equal(parsed.draft.variables[1].formula,'hour + 2');const restored=createStructureInstance(template,null,{modulus:12});applyStructureInstanceDraft(restored,parsed.draft);assert.equal(restored.relationStyles.typeOverrides.successor.color,'#123456');const changed=source.replace('from "mod-0"','from "mod-2"'),invalid=parseStructureInstanceSource(changed,{template,instance});assert.equal(invalid.valid,false);assert.match(invalid.diagnostics[0].message,/topology is protected/)
});

test('Structure source invalid draft keeps diagnostics with exact line and column',()=>{
  const template=getBuiltinTemplate('builtin:mod-n'),instance=createStructureInstance(template),source=serializeStructureInstance(template,instance).replace('parameter modulus = 12','parameter modulus =');const parsed=parseStructureInstanceSource(source,{template,instance});assert.equal(parsed.valid,false);assert.ok(parsed.diagnostics[0].line>0);assert.ok(parsed.diagnostics[0].column>0)
});

test('Venn presentation keeps semantic region keys while labels can change',()=>{
  const template=getBuiltinTemplate('builtin:venn-2'),instance=createStructureInstance(template);instance.parameters.setLabels=['命题','反例'];const prepared=getStructureInteractionAdapter(template).prepareDefinition(materializeInstanceDefinition(template,instance),instance);assert.deepEqual(prepared.slots.map(item=>item.id),['A-only','intersection','B-only']);assert.deepEqual(prepared.slots.map(item=>item.label),['命题∖反例','命题∩反例','反例∖命题'])
});

test('V4.2.1 source removes global Edit Mode and includes Code, tab, hover, and responsive contracts',async()=>{
  const[controller,html,css,manifest]=await Promise.all(['packages/ui/workspace-controller.js','apps/web/index.html','apps/web/styles.css','apps/web/manifest.webmanifest'].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));
  assert.doesNotMatch(controller,/this\.mode|toggleEditMode|setMode\(|\/edit/);
  assert.doesNotMatch(html,/editModeButton/);
  assert.doesNotMatch(css,/edit-mode-button|\.editing/);
  assert.match(controller,/openTabMenu|openStructureSource|renderRelationStyleWorkbench|structureSourceKeys|renderSourceSyntax/);
  assert.match(html,/sourceWorkbench|sourceSyntaxHighlight|V4\.(?:2\.[1234] RC|3\.[01](?: RC)?)/);
  assert.match(css,/node-hover-tooltip.*max-height|source-workbench-split|variable-table-head/);
  assert.match(manifest,/V4\.(?:2\.[1234] RC|3\.[01](?: RC)?)/)
});
