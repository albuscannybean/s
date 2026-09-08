import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_TEMPLATES,getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {createStructureInstance,materializeInstanceDefinition,addInstanceSlot,addInstanceEdge,updateInstanceEdge} from '../packages/structure-engine/model.js';
import {parseStructureInstanceSource,serializeStructureInstance} from '../packages/lkl2/structure-source.js';
import {resolveRelationStyle,setRelationStyle} from '../packages/structure-engine/relation-style-resolver.js';
import {buildSceneGeometry} from '../packages/geometry/scene-geometry.js';

function parse(template,instance,source){const result=parseStructureInstanceSource(source,{template,instance});assert.equal(result.valid,true,JSON.stringify(result.diagnostics));return result.draft}
test('every builtin structure source round-trips its topology and visible relation styles',()=>{
 for(const template of BUILTIN_TEMPLATES){
  const instance=createStructureInstance(template),before=materializeInstanceDefinition(template,instance),draft=parse(template,instance,serializeStructureInstance(template,instance)),after=materializeInstanceDefinition(template,draft);
  assert.deepEqual(after.edges.map(e=>[e.id,e.sourceSlotId,e.targetSlotId]),before.edges.map(e=>[e.id,e.sourceSlotId,e.targetSlotId]),template.id);
  assert.deepEqual(after.edges.map(e=>resolveRelationStyle(e,draft)),before.edges.map(e=>resolveRelationStyle(e,instance)),template.id);
 }
});
test('explicit relation edits survive old topology patches and structure-wide defaults',()=>{
 const t=getBuiltinTemplate('builtin:mod-n'),i=createStructureInstance(t),first=materializeInstanceDefinition(t,i).edges[0];
 updateInstanceEdge(i,first.id,{displayLabel:'old',routing:'orthogonal'});
 setRelationStyle(i,{scope:'all'},{routing:'straight',color:'#223344'});
 const source=serializeStructureInstance(t,i).replace('label "old"','label "new"').replace('routing "straight"','routing "bezier"'),draft=parse(t,i,source),definition=materializeInstanceDefinition(t,draft),scene=buildSceneGeometry(definition,draft);
 assert.equal(definition.edges[0].displayLabel,'new');assert.equal(scene.edges[0].routing,'straight');assert.equal(draft.relationStyles.edgeOverrides[first.id].routing,'bezier');assert.ok(scene.edges.slice(1).every(e=>e.routing==='straight'));
 const restored=parse(t,draft,serializeStructureInstance(t,draft));assert.equal(buildSceneGeometry(materializeInstanceDefinition(t,restored),restored).edges[0].routing,'straight');
});
test('editing the aggregate style retains its scope instead of freezing unchanged relation blocks',()=>{
 const t=getBuiltinTemplate('builtin:mod-n'),i=createStructureInstance(t);
 setRelationStyle(i,{scope:'all'},{color:'#123456'});
 const source=serializeStructureInstance(t,i).replace('"structureDefault": {\n    "color": "#123456"','"structureDefault": {\n    "color": "#654321"');
 const draft=parse(t,i,source),definition=materializeInstanceDefinition(t,draft);
 assert.ok(definition.edges.every(e=>resolveRelationStyle(e,draft).color==='#654321'));assert.deepEqual(draft.relationStyles.edgeOverrides,{});
});
test('a UI-extended poset remains editable and invalid cycles fail without mutating the source instance',()=>{
 const t=getBuiltinTemplate('builtin:poset-hasse'),i=createStructureInstance(t,null,{starter:'blank'});
 const a=addInstanceSlot(i,{id:'a',label:'a'},{template:t}),b=addInstanceSlot(i,{id:'b',label:'b'},{template:t});
 addInstanceEdge(i,a.id,b.id,{id:'ab',direction:'directed',relationType:'covers'},{template:t});
 addInstanceSlot(i,{id:'c',label:'c'},{template:t});addInstanceEdge(i,'b','c',{id:'bc',direction:'directed',relationType:'covers'},{template:t});
 const source=serializeStructureInstance(t,i),draft=parse(t,i,source);assert.equal(materializeInstanceDefinition(t,draft).slots.length,3);
 const snapshot=structuredClone(i),bad=source.replace('from "a"','from "c"'),result=parseStructureInstanceSource(bad,{template:t,instance:i});
 assert.equal(result.valid,false);assert.deepEqual(i,snapshot);
});
test('parameter changes regenerate canonical topology without retaining stale source endpoints',()=>{
 const t=getBuiltinTemplate('builtin:mod-n'),i=createStructureInstance(t),source=serializeStructureInstance(t,i).replace('parameter modulus = 12','parameter modulus = 8'),draft=parse(t,i,source),definition=materializeInstanceDefinition(t,draft);
 assert.equal(definition.slots.length,8);assert.equal(definition.edges.length,8);assert.equal(definition.edges.at(-1).targetSlotId,'mod-0');
});
test('canonical endpoint protection applies equally to relation blocks and aggregate topology JSON',()=>{
 const t=getBuiltinTemplate('builtin:mod-n'),i=createStructureInstance(t),source=serializeStructureInstance(t,i);
 assert.equal(parseStructureInstanceSource(source.replace('from "mod-0"','from "mod-3"'),{template:t,instance:i}).valid,false);
 const id=materializeInstanceDefinition(t,i).edges[0].id,bad=source.replace('"edgePatches": {}','"edgePatches": {"'+id+'":{"sourceSlotId":"mod-3"}}');
 assert.equal(parseStructureInstanceSource(bad,{template:t,instance:i}).valid,false);
});
