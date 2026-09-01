import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createStructureInstance,materializeInstanceDefinition,updateInstanceEdge} from '../packages/structure-engine/model.js';
import {getBuiltinTemplate} from '../packages/structure-engine/templates.js';
import {containerCapabilities,edgeCapabilities,getStructureInteractionAdapter} from '../packages/structure-engine/interaction-adapters.js';
import {DEFAULT_OBJECT_CAPABILITIES} from '../packages/domain/semantic-container.js';
import {appendPath,slotSegment} from '../packages/navigation/path.js';
import {contentPreview,isSubstantiveContent,markdownToPlainText} from '../packages/ui/content-preview.js';
import {contentItemActions,interactionFor,supportsDoubleClick} from '../packages/ui/object-interaction-contract.js';

test('V4.1.3 converges every object on one primary interaction',()=>{
  const expected={knowledge:'open',structure:'open',container:'open',content:'open',relation:'select',canvas:'clear-or-pan'};
  for(const[kind,primary]of Object.entries(expected)){assert.equal(interactionFor(kind).primary,primary);assert.equal(supportsDoubleClick(kind),false)}
  assert.equal(interactionFor('slot').primary,'open');assert.equal(interactionFor('edge').primary,'select');
  assert.deepEqual(contentItemActions({type:'knowledge'}),['open','reference-info','move','copy-reference','unlink']);
  assert.deepEqual(contentItemActions({type:'content'}),['open','edit','move','copy','delete']);
});

test('content cards share a plain three-line-ready preview and preserve a real formula',()=>{
  const source='# 拉格朗日定理\n\n**有限群** $G$ 的子群阶整除群阶。\n\n$$|H|\\mid|G|$$\n\n[参考](https://example.test)';
  const preview=contentPreview({title:'定理',body:source},{maxChars:90});
  assert.equal(preview.title,'定理');assert.equal(preview.displayFormula,'|H|\\mid|G|');assert.doesNotMatch(preview.excerpt,/[#*\[\]()`]/);assert.ok(preview.excerpt.length<=91);
  assert.equal(markdownToPlainText('> **证明**：`x`'),'证明：x');assert.equal(isSubstantiveContent({body:'  '}),false);assert.equal(isSubstantiveContent({tags:['群论']}),true);
});

test('canonical LMN topology is protected while labels, content, and appearance stay editable',()=>{
  const template=getBuiltinTemplate('builtin:lmn-432'),instance=createStructureInstance(template),definition=materializeInstanceDefinition(template,instance),slot=definition.slots.find(item=>item.id==='L2'),edge=definition.edges[0],slotCaps=containerCapabilities(template,slot,instance),edgeCaps=edgeCapabilities(template,edge,instance);
  for(const key of Object.keys(DEFAULT_OBJECT_CAPABILITIES))assert.equal(typeof slotCaps[key],'boolean',`missing ${key}`);
  assert.equal(slotCaps.canMoveVisualPosition,false);assert.equal(slotCaps.canMoveSemanticPosition,false);assert.equal(slotCaps.canDeleteCanonicalObject,false);assert.equal(slotCaps.canRenameDisplayLabel,true);assert.equal(slotCaps.canEditContent,true);assert.equal(slotCaps.canEditAppearance,true);
  assert.equal(edgeCaps.canChangeEndpoints,false);assert.equal(edgeCaps.canChangeDirection,false);assert.equal(edgeCaps.canChangeRelationType,false);assert.equal(edgeCaps.canDeleteCanonicalObject,false);assert.equal(edgeCaps.canRenameDisplayLabel,true);assert.equal(edgeCaps.canEditContent,true);assert.equal(edgeCaps.canEditAppearance,true);
});

test('custom LMN variants regain topology editing without changing the canonical adapter',()=>{
  const canonical=getBuiltinTemplate('builtin:lmn-432'),custom={...structuredClone(canonical),id:'custom:lmn-editable',builtin:false},canonicalAdapter=getStructureInteractionAdapter(canonical),customAdapter=getStructureInteractionAdapter(custom);
  assert.equal(canonicalAdapter.id,'lmn');assert.equal(customAdapter.id,'graph');assert.equal(customAdapter.getContainerCapabilities({id:'L2'},null,custom).canDeleteCanonicalObject,true);
});

test('relation types never materialize blank and display labels remain independent',()=>{
  const template=structuredClone(getBuiltinTemplate('builtin:directed-graph'));template.edges[0].relationType='';const instance=createStructureInstance(template),definition=materializeInstanceDefinition(template,instance),edge=definition.edges[0];assert.equal(edge.relationType,'related');
  updateInstanceEdge(instance,edge.id,{displayLabel:'前提关系'});const updated=materializeInstanceDefinition(template,instance).edges[0];assert.equal(updated.displayLabel,'前提关系');assert.equal(updated.relationType,'related');
});

test('breadcrumb paths update document state for an already-open object',()=>{
  const slot={id:'L2',label:'存在',displayLabel:'现实存在',role:'existence'},segment=slotSegment('instance-1',slot);assert.equal(segment.label,'现实存在');
  const reading={kind:'content',id:'note-1',instanceId:'instance-1',document:'content:instance-1:L2:note-1',label:'定义'},editing={...reading,document:'content-edit:instance-1:L2:note-1'};
  const path=appendPath([segment],reading),updated=appendPath(path,editing);assert.equal(updated.length,2);assert.equal(updated[1].document,editing.document);
});

test('removed peek, expand-in-place, and floating toolbar systems do not return',async()=>{
  const [html,controller,geometry,css]=await Promise.all([
    readFile(new URL('../apps/web/index.html',import.meta.url),'utf8'),
    readFile(new URL('../packages/ui/workspace-controller.js',import.meta.url),'utf8'),
    readFile(new URL('../packages/geometry/scene-geometry.js',import.meta.url),'utf8'),
    readFile(new URL('../apps/web/styles.css',import.meta.url),'utf8')
  ]);
  for(const source of[html,controller,geometry,css]){assert.doesNotMatch(source,/containerPeek|contextToolbar|expandedContainers|expandContainerGeometry|container-peek|context-toolbar/)}
  assert.doesNotMatch(controller,/\.ondblclick\s*=.*(?:open|insert|navigate)/);
});
